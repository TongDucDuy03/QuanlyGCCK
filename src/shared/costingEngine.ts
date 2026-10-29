import type {
  OperationMeta,
  OpLogSummary,
  OpStepCostBreakdown,
  ProductCostingSummary,
  ProductMeta,
} from './types';

/**
 * Computes Standard Costing + Anti-Fake-Profit Actual Costing for a Product across its routing steps.
 * - finishedQty counts ONLY logs on the final operation (isFinalOp === 1).
 * - If finishedQty === 0 (e.g. SP095 with 8 pcs on step 1 and 0 pcs on step 2), hasActual = false,
 *   wipQty = 8, actualUnitCost = totalStdCost, totalBatchProfit = 0.
 * - If finishedQty > 0 and an upstream step was not logged (loggedOkQty === 0), substitutes
 *   stdOpUnitCost (including 10% overhead) for that step to prevent fake profit.
 * - Real-world Shopfloor support: All-in Machine Rate (800k/ca 8h = 100k/h) & 8h Shift Quota.
 */
export function computeProductCosting(
  product: ProductMeta,
  ops: OperationMeta[],
  logs: OpLogSummary[],
  options?: {
    costingModel?: 'ALL_IN_MACHINE' | 'DETAILED_BREAKDOWN';
    allInRatePerHour?: number;
  }
): ProductCostingSummary {
  const sortedOps = [...ops].sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));

  let stdLabor = 0;
  let stdMach = 0;
  let stdTool = 0;
  let totalSec = 0;

  for (const op of sortedOps) {
    stdLabor += Math.round(Number(op.stdLaborCost) || 0);
    stdMach += Math.round(Number(op.stdMachCost) || 0);
    stdTool += Math.round(Number(op.stdToolCost) || 0);
    totalSec += Math.round(Number(op.stdSeconds) || 0);
  }

  const machiningBase = stdLabor + stdMach + stdTool;
  const stdOverhead = Math.round(machiningBase * 0.1);
  const rawMaterialCost = Math.round(Number(product.rawMaterialCost) || 0);
  const outsourceCost = Math.round(Number(product.outsourceCost) || 0);
  let totalStdCost = machiningBase + stdOverhead + rawMaterialCost + outsourceCost;

  // Real-world All-in Machine Rate (800k/ca 8h = 100k/h)
  const allInRatePerHour = Math.max(1, Number(options?.allInRatePerHour) || 100000);
  const allInMachineCost = Math.round((totalSec / 3600) * allInRatePerHour) + rawMaterialCost + outsourceCost;
  const shiftQuota8h = totalSec > 0 ? Math.floor(28800 / totalSec) : 0;

  if (options?.costingModel === 'ALL_IN_MACHINE') {
    totalStdCost = allInMachineCost;
  }

  // Aggregate non-voided logs per ncId
  const activeLogs = (logs || []).filter((l) => !l.isVoided);
  const logAgg = new Map<string, { okQty: number; batchCost: number }>();
  for (const l of activeLogs) {
    const prev = logAgg.get(l.ncId) || { okQty: 0, batchCost: 0 };
    prev.okQty += Math.max(0, Number(l.okQty) || 0);
    prev.batchCost += Math.max(0, Number(l.batchCost) || 0) + Math.max(0, Number(l.scrapCost) || 0);
    logAgg.set(l.ncId, prev);
  }

  // Locate final op (strictly isFinalOp === 1; fallback to last sorted op only if none marked)
  const explicitFinalOp = sortedOps.find((o) => Number(o.isFinalOp) === 1);
  const finalOp = explicitFinalOp ?? sortedOps[sortedOps.length - 1];

  let finishedQty = 0;
  let maxUpstreamQty = 0;
  let wipBatchCost = 0;

  const stepBreakdowns: OpStepCostBreakdown[] = sortedOps.map((op) => {
    const agg = logAgg.get(op.ncId) || { okQty: 0, batchCost: 0 };
    const opStdBase = (Number(op.stdLaborCost) || 0) + (Number(op.stdMachCost) || 0) + (Number(op.stdToolCost) || 0);
    const stdOpUnitCost = Math.round(opStdBase * 1.1);
    const isFinal = finalOp && op.ncId === finalOp.ncId ? 1 : 0;

    if (isFinal === 1) {
      finishedQty = agg.okQty;
    } else {
      if (agg.okQty > maxUpstreamQty) maxUpstreamQty = agg.okQty;
      wipBatchCost += agg.batchCost;
    }

    const usedStdFallback = agg.okQty <= 0;
    const effectiveUnitCost = usedStdFallback ? stdOpUnitCost : Math.round(agg.batchCost / agg.okQty);

    return {
      ncId: op.ncId,
      opName: op.opName,
      stepOrder: op.stepOrder,
      isFinalOp: isFinal,
      stdSeconds: op.stdSeconds,
      stdOpUnitCost,
      loggedOkQty: agg.okQty,
      loggedBatchCost: agg.batchCost,
      effectiveUnitCost,
      usedStdFallback,
    };
  });

  const wipQty = Math.max(0, maxUpstreamQty - finishedQty);
  const hasActual = finishedQty > 0;

  let actualUnitCost = totalStdCost;
  let actualBatchCost = 0;

  if (hasActual) {
    const sumStepUnitCosts = stepBreakdowns.reduce((sum, s) => sum + s.effectiveUnitCost, 0);
    actualUnitCost = sumStepUnitCosts + rawMaterialCost + outsourceCost;
    actualBatchCost = actualUnitCost * finishedQty;
  }

  const quotedPrice = Math.round(Number(product.quotedPrice) || 0);
  const unitProfit = quotedPrice - (hasActual ? actualUnitCost : totalStdCost);
  const totalBatchProfit = hasActual ? unitProfit * finishedQty : 0;
  const marginPct =
    quotedPrice > 0 ? Number(((unitProfit / quotedPrice) * 100).toFixed(1)) : 0;
  const shiftTargetRevenue = shiftQuota8h * quotedPrice;

  return {
    spId: product.spId,
    customer: product.customer,
    productName: product.productName,
    opCount: sortedOps.length,
    opsSummary: sortedOps.map((o) => o.opName).join(' → '),
    totalSec,
    totalHours: Number((totalSec / 3600).toFixed(2)),
    stdLabor,
    stdMach,
    stdTool,
    stdOverhead,
    rawMaterialCost,
    outsourceCost,
    totalStdCost,
    quotedPrice,
    wipQty,
    wipBatchCost,
    finishedQty,
    actualBatchCost,
    actualUnitCost,
    unitProfit,
    totalBatchProfit,
    marginPct,
    hasActual,
    stepBreakdowns,
    drawingUrl: product.drawingUrl || '',
    techDocUrl: product.techDocUrl || '',
    allInMachineCost,
    shiftQuota8h,
    shiftTargetRevenue,
  };
}
