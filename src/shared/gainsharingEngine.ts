export interface GainsharingInput {
  productName: string;
  opName?: string;
  machineId?: string;
  machineName?: string;
  stdSeconds: number;
  shiftHours?: number; // default 8
  shiftCost: number; // e.g. 700000, 800000
  actualQty: number; // e.g. 40 pcs
  actualHours?: number; // default 8
  workerShiftWage?: number; // default 385000
  bonusShareRate: number; // 0.1 to 0.9, default 0.40 (40%)
  scrapQty?: number;
  scrapDamagePerPcs?: number;
}

export interface GainsharingResult {
  stdSeconds: number;
  shiftCost: number;
  costPerHour: number;
  costPerSec: number;
  stdOpUnitCost: number;
  stdQtyPerShift: number;
  actualQty: number;
  actualHours: number;
  kpiPct: number;
  earnedStdSeconds: number;
  actualNetSeconds: number;
  surplusQty: number;
  surplusSeconds: number;
  surplusHours: number;
  grossSurplusValue: number;
  scrapPenaltyTotal: number;
  netSurplusValue: number;
  workerIncentiveBonus: number;
  workerBonusPerSurplusPcs: number;
  workerTotalTurnIncome: number;
  companySurplusProfit: number;
  actualUnitMachiningCost: number;
  unitCostReduction: number;
  unitCostReductionPct: number;
  projectedMonthlyWorkerBonus: number;
  projectedMonthlyCompanyProfit: number;
  isSurplusAchieved: boolean;
}

/**
 * Pure calculation engine for mechanical machining productivity gainsharing
 * based on all-in machine shift rate (Đơn giá trọn gói 1 Ca 8h = 28.800 giây).
 */
export function computeGainsharing(input: GainsharingInput): GainsharingResult {
  const stdSeconds = Math.max(1, Math.round(Number(input.stdSeconds) || 1));
  const shiftHours = Number(input.shiftHours) || 8;
  const shiftSeconds = shiftHours * 3600;
  const actualHours = Number(input.actualHours) || 8;
  const actualNetSeconds = actualHours * 3600;

  const shiftCost = Math.max(0, Math.round(Number(input.shiftCost) || 0));
  const costPerHour = Math.round(shiftCost / shiftHours);
  const costPerSec = Number((shiftCost / shiftSeconds).toFixed(4));

  // Unit machine cost under standard conditions
  const stdOpUnitCost = Math.round(stdSeconds * (shiftCost / shiftSeconds));
  // Exact standard quantity feasible in 1 standard shift
  const stdQtyPerShift = Math.floor(shiftSeconds / stdSeconds);

  const actualQty = Math.max(0, Math.round(Number(input.actualQty) || 0));
  const earnedStdSeconds = actualQty * stdSeconds;
  const kpiPct = actualNetSeconds > 0 ? Math.round((earnedStdSeconds / actualNetSeconds) * 100) : 0;

  const surplusQty = Math.max(0, actualQty - stdQtyPerShift);
  const surplusSeconds = Math.max(0, earnedStdSeconds - actualNetSeconds);
  const surplusHours = Number((surplusSeconds / 3600).toFixed(2));

  // The gross value of machine hours/seconds saved by worker's high productivity
  const grossSurplusValue = Math.round(surplusSeconds * (shiftCost / shiftSeconds));

  const scrapQty = Math.max(0, Number(input.scrapQty) || 0);
  const scrapDamagePerPcs = Math.max(0, Number(input.scrapDamagePerPcs) || 0);
  const scrapPenaltyTotal = Math.round(scrapQty * scrapDamagePerPcs);

  const netSurplusValue = Math.max(0, grossSurplusValue - scrapPenaltyTotal);
  const bonusShareRate = Math.min(1, Math.max(0, Number(input.bonusShareRate) || 0.4));

  const isSurplusAchieved = actualQty > stdQtyPerShift && netSurplusValue > 0;
  const workerIncentiveBonus = isSurplusAchieved ? Math.round(netSurplusValue * bonusShareRate) : 0;
  const companySurplusProfit = isSurplusAchieved ? netSurplusValue - workerIncentiveBonus : 0;

  const workerBonusPerSurplusPcs = surplusQty > 0 ? Math.round(workerIncentiveBonus / surplusQty) : 0;
  const workerBaseShiftWage = Math.max(0, Number(input.workerShiftWage) || 385000);
  const workerTotalTurnIncome = workerBaseShiftWage + workerIncentiveBonus - scrapPenaltyTotal;

  // Actual machine cost per piece = (Total machine shift cost paid + worker incentive) / actualQty
  const actualUnitMachiningCost =
    actualQty > 0
      ? Math.round((shiftCost + workerIncentiveBonus) / actualQty)
      : stdOpUnitCost;

  const unitCostReduction = Math.max(0, stdOpUnitCost - actualUnitMachiningCost);
  const unitCostReductionPct =
    stdOpUnitCost > 0 ? Number(((unitCostReduction / stdOpUnitCost) * 100).toFixed(1)) : 0;

  // Assuming 26 shifts/month
  const projectedMonthlyWorkerBonus = workerIncentiveBonus * 26;
  const projectedMonthlyCompanyProfit = companySurplusProfit * 26;

  return {
    stdSeconds,
    shiftCost,
    costPerHour,
    costPerSec,
    stdOpUnitCost,
    stdQtyPerShift,
    actualQty,
    actualHours,
    kpiPct,
    earnedStdSeconds,
    actualNetSeconds,
    surplusQty,
    surplusSeconds,
    surplusHours,
    grossSurplusValue,
    scrapPenaltyTotal,
    netSurplusValue,
    workerIncentiveBonus,
    workerBonusPerSurplusPcs,
    workerTotalTurnIncome,
    companySurplusProfit,
    actualUnitMachiningCost,
    unitCostReduction,
    unitCostReductionPct,
    projectedMonthlyWorkerBonus,
    projectedMonthlyCompanyProfit,
    isSurplusAchieved,
  };
}
