import { describe, it, expect } from 'vitest';
import {
  getVietnamDateString,
  isVietnamSunday,
  hasTimeOverlap,
  calculateMarginalScrapPenalty,
  calculateTurnPayroll,
  DEFAULT_PAYROLL_CONFIG,
} from '../../src/shared/payrollEngine';
import type { PayrollCalcInput } from '../../src/shared/types';

function makeBaseInput(overrides: Partial<PayrollCalcInput> = {}): PayrollCalcInput {
  return {
    workerId: 'NV00214',
    salaryMode: 'Khoán 1 + 0.33 máy',
    costPerSec: 13.89,
    workDate: '2026-10-26', // Monday
    shiftType: 'Ca 1 (Sáng 06h-14h)',
    startTime: '06:00',
    endTime: '14:00',
    overtimeMinutes: 0,
    isSunday: false,
    machineName: 'Máy Tiện CNC 1',
    machineMode: 'FIRST',
    machineCostPerHour: 350000,
    stdSeconds: 3600,
    stdEdgesPerPcs: 2,
    costPerEdge: 27500,
    okQty: 8,
    reworkQty: 0,
    scrapQty: 0,
    defectType: 'Lỗi Chủ quan Cơ khí',
    damageValue: 0,
    stopMinutes: 0,
    stopReason: 'Không có dừng máy',
    ...overrides,
  };
}

describe('payrollEngine — Timezone, 1+0.33 Overlap, Meal Cap, OT Anti-Exploit & Marginal NG', () => {
  it('computes Vietnam date string (UTC+7) and Sunday detection accurately', () => {
    // 2026-10-25T18:30:00Z is 2026-10-26 01:30:00 in Asia/Ho_Chi_Minh (Monday)
    const utcLateSun = new Date('2026-10-25T18:30:00.000Z');
    expect(getVietnamDateString(utcLateSun)).toBe('2026-10-26');
    expect(isVietnamSunday('2026-10-25')).toBe(true);
    expect(isVietnamSunday('2026-10-26')).toBe(false);
  });

  it('distinguishes sequential runs vs overlapping concurrent runs across 2 machines (1 + 0.33)', () => {
    expect(hasTimeOverlap('06:00', '10:00', '10:00', '14:00')).toBe(false);
    expect(hasTimeOverlap('06:00', '14:00', '08:00', '12:00')).toBe(true);
    expect(hasTimeOverlap('22:00', '06:00', '01:00', '05:00')).toBe(true);

    // Sequential on 2 different machines -> keeps 1.0 rate
    const seqRes = calculateTurnPayroll(
      makeBaseInput({ machineName: 'Máy Tiện CNC 2', startTime: '10:00', endTime: '14:00', okQty: 4 }),
      {
        priorLogs: [{ machineName: 'Máy Tiện CNC 1', startTime: '06:00', endTime: '10:00' }],
      },
      DEFAULT_PAYROLL_CONFIG
    );
    expect(seqRes.effectiveMachineMode).toBe('FIRST');
    expect(seqRes.machRate).toBe(1.0);

    // Overlapping on 2 different machines -> enforces 0.33 rate automatically
    const ovlRes = calculateTurnPayroll(
      makeBaseInput({ machineName: 'Máy Tiện CNC 2', startTime: '08:00', endTime: '12:00', okQty: 4 }),
      {
        priorLogs: [{ machineName: 'Máy Tiện CNC 1', startTime: '06:00', endTime: '14:00' }],
      },
      DEFAULT_PAYROLL_CONFIG
    );
    expect(ovlRes.effectiveMachineMode).toBe('SECOND');
    expect(ovlRes.machRate).toBe(0.33);
  });

  it('caps meal allowance once per shift (workerId, workDate, shiftType) across multi-submissions', () => {
    const shift2Input = makeBaseInput({ shiftType: 'Ca 2 (Chiều 14h-22h)', startTime: '14:00', endTime: '22:00', okQty: 3 });
    const firstTurn = calculateTurnPayroll(shift2Input, {}, DEFAULT_PAYROLL_CONFIG);
    expect(firstTurn.mealAllowance).toBe(20000);

    const secondTurn = calculateTurnPayroll(
      shift2Input,
      { mealAlreadyPaid: true, mealPaidAmount: 20000 },
      DEFAULT_PAYROLL_CONFIG
    );
    expect(secondTurn.mealAllowance).toBe(0);
  });

  it('blocks 0-qty + 0-objective-stop OT exploit (returns 0 OT bonus and 0 meal)', () => {
    const exploitRes = calculateTurnPayroll(
      makeBaseInput({
        okQty: 0,
        scrapQty: 0,
        stopMinutes: 0,
        overtimeMinutes: 240,
      }),
      {},
      DEFAULT_PAYROLL_CONFIG
    );
    expect(exploitRes.otBonusWage).toBe(0);
    expect(exploitRes.mealAllowance).toBe(0);
    expect(exploitRes.turnTotalIncome).toBe(0);
  });

  it('pays objective stop wage (Chờ phôi/cẩu) at 100% CB but NOT Thay dao / Setup', () => {
    const objStop = calculateTurnPayroll(
      makeBaseInput({ okQty: 0, stopMinutes: 60, stopReason: 'Chờ phôi / Chờ cẩu' }),
      {},
      DEFAULT_PAYROLL_CONFIG
    );
    expect(objStop.waitWage).toBe(Math.round(3600 * 13.89));

    const setupStop = calculateTurnPayroll(
      makeBaseInput({ okQty: 4, stopMinutes: 45, stopReason: 'Thay dao / Setup' }),
      {},
      DEFAULT_PAYROLL_CONFIG
    );
    expect(setupStop.waitWage).toBe(0);
  });

  it('calculates strictly monotonically increasing marginal NG penalty (no 10M/30M cliff)', () => {
    const p10m = calculateMarginalScrapPenalty(10_000_000);
    const p10mPlus1 = calculateMarginalScrapPenalty(10_000_001);
    const p20m = calculateMarginalScrapPenalty(20_000_000);
    const p30m = calculateMarginalScrapPenalty(30_000_000);
    const p30mPlus1 = calculateMarginalScrapPenalty(30_000_001);
    const p40m = calculateMarginalScrapPenalty(40_000_000);

    expect(p10m).toBe(5_000_000);
    expect(p10mPlus1).toBeGreaterThan(p10m);
    expect(p20m).toBe(9_000_000); // 5M + 10M*40%
    expect(p30m).toBe(13_000_000); // 5M + 20M*40%
    expect(p30mPlus1).toBeGreaterThan(p30m);
    expect(p40m).toBe(16_000_000); // 13M + 10M*30%
  });

  it('separates Hành chính (Tháng) staff: directPieceIncome = 0 while preserving batchCost & kpiPct', () => {
    const monthlyRes = calculateTurnPayroll(
      makeBaseInput({
        workerId: 'NV00053',
        salaryMode: 'Hành chính (Tháng)',
        costPerSec: 18.75,
        machineName: 'Máy tiện FUJI',
        machineCostPerHour: 350000,
        stdSeconds: 3600,
        stdEdgesPerPcs: 2.1,
        costPerEdge: 20833.3333,
        okQty: 8,
      }),
      {},
      DEFAULT_PAYROLL_CONFIG
    );
    expect(monthlyRes.isMonthlyStaff).toBe(true);
    expect(monthlyRes.directPieceIncome).toBe(0);
    expect(monthlyRes.kpiPct).toBe(100);
    expect(monthlyRes.batchCost).toBeGreaterThan(3_600_000);
  });

  it('applies Shift 3 (1.3x), Sunday (2.0x), and 50% casting-defect support accurately', () => {
    const s3 = calculateTurnPayroll(
      makeBaseInput({
        shiftType: 'Ca 3 (Đêm 22h-06h)',
        startTime: '22:00',
        endTime: '06:00',
        okQty: 2,
        scrapQty: 2,
        defectType: 'Lỗi Phôi Đúc/NL',
      }),
      {},
      DEFAULT_PAYROLL_CONFIG
    );
    // 2 OK + 2*0.5 casting support = 3.0 * 3600s = 10800s, x1.3 shift 3
    expect(s3.shiftMult).toBe(1.3);
    expect(s3.earnedStdSeconds).toBe(10800);
    expect(s3.basePieceWage).toBe(Math.round(10800 * 1.3 * 13.89));

    const sun = calculateTurnPayroll(
      makeBaseInput({
        workDate: '2026-10-25',
        isSunday: true,
        okQty: 2,
      }),
      {},
      DEFAULT_PAYROLL_CONFIG
    );
    expect(sun.shiftMult).toBe(2.0);
    expect(sun.mealAllowance).toBe(30000);
  });

  it('normalizes kpiWarningThreshold whether configured as decimal (0.85) or whole percentage (85)', () => {
    // 7 pcs * 3600s = 25200s out of 28800s shift -> kpiPct = 88%
    const decCfg = { ...DEFAULT_PAYROLL_CONFIG, kpiWarningThreshold: 0.85 };
    const wholeCfg = { ...DEFAULT_PAYROLL_CONFIG, kpiWarningThreshold: 85 };

    const resDec = calculateTurnPayroll(makeBaseInput({ okQty: 7 }), {}, decCfg);
    const resWhole = calculateTurnPayroll(makeBaseInput({ okQty: 7 }), {}, wholeCfg);
    expect(resDec.kpiPct).toBe(88);
    expect(resDec.kpiStatus).toBe('Đạt 88% ĐM');
    expect(resWhole.kpiPct).toBe(88);
    expect(resWhole.kpiStatus).toBe('Đạt 88% ĐM');

    // 6 pcs * 3600s = 21600s out of 28800s -> kpiPct = 75% (< 85% warning threshold)
    const lowWhole = calculateTurnPayroll(makeBaseInput({ okQty: 6 }), {}, wholeCfg);
    expect(lowWhole.kpiPct).toBe(75);
    expect(lowWhole.kpiStatus).toContain('Chưa đạt ĐM');
  });
});
