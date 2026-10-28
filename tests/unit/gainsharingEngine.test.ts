import { describe, expect, it } from 'vitest';
import { computeGainsharing } from '../../src/shared/gainsharingEngine';

describe('computeGainsharing', () => {
  it('correctly calculates standard baseline when actualQty == stdQtyPerShift', () => {
    const res = computeGainsharing({
      productName: 'Chi tiết mẫu',
      stdSeconds: 900, // 15 mins -> 32 pcs in 8h (28800s)
      shiftCost: 1600000,
      actualQty: 32,
      bonusShareRate: 0.4,
    });

    expect(res.stdQtyPerShift).toBe(32);
    expect(res.stdOpUnitCost).toBe(50000);
    expect(res.surplusQty).toBe(0);
    expect(res.kpiPct).toBe(100);
    expect(res.workerIncentiveBonus).toBe(0);
    expect(res.companySurplusProfit).toBe(0);
    expect(res.actualUnitMachiningCost).toBe(50000);
  });

  it('correctly calculates surplus and 40% incentive bonus when worker achieves 125% productivity', () => {
    const res = computeGainsharing({
      productName: 'Chi tiết mẫu vượt định mức',
      stdSeconds: 900,
      shiftCost: 1600000,
      actualQty: 40, // 40 pcs vs 32 pcs std (surplus 8 pcs)
      bonusShareRate: 0.4,
    });

    expect(res.stdQtyPerShift).toBe(32);
    expect(res.surplusQty).toBe(8);
    expect(res.kpiPct).toBe(125);
    expect(res.surplusHours).toBe(2); // 7200s = 2h saved
    expect(res.grossSurplusValue).toBe(400000); // 8 * 50,000 = 400,000đ
    expect(res.workerIncentiveBonus).toBe(160000); // 40% of 400k
    expect(res.companySurplusProfit).toBe(240000); // 60% of 400k
    expect(res.workerBonusPerSurplusPcs).toBe(20000); // 160k / 8 pcs
    // Machine cost per piece reduced from 50k to (1.6M + 160k) / 40 = 44,000đ (-12%)
    expect(res.actualUnitMachiningCost).toBe(44000);
    expect(res.unitCostReduction).toBe(6000);
    expect(res.unitCostReductionPct).toBe(12);
  });

  it('applies scrap penalty safely without causing negative bonus', () => {
    const res = computeGainsharing({
      productName: 'Hàng có phế phẩm',
      stdSeconds: 900,
      shiftCost: 1600000,
      actualQty: 35, // 3 surplus pcs = 150k gross
      bonusShareRate: 0.4,
      scrapQty: 2,
      scrapDamagePerPcs: 100000, // 200k penalty > 150k gross
    });

    expect(res.netSurplusValue).toBe(0);
    expect(res.workerIncentiveBonus).toBe(0);
    expect(res.companySurplusProfit).toBe(0);
  });
});
