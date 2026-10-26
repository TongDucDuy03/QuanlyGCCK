import { describe, it, expect } from 'vitest';
import {
  getDaysInMonth,
  parseAttendanceCell,
  computeEmployeeMonthlyStats,
  computeMonthly3PPayroll,
  DEFAULT_MEAL_CONFIG,
} from '../../src/shared/attendanceParser';
import type { AttendanceRow } from '../../src/shared/types';

describe('attendanceParser — Real GCCK Codes, Dynamic Month Days, Meal Unification & 3P Payroll', () => {
  it('returns exact days in month including leap/non-leap February', () => {
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2026, 4)).toBe(30);
    expect(getDaysInMonth(2026, 10)).toBe(31);
  });

  it('decodes all GCCK attendance codes accurately (X, x/2, 6.25, C2+2, C2/2-0.75, K+2TK, C3+2D, X/2+O/2, P, KP, 0)', () => {
    expect(parseAttendanceCell('X', 'Hành chính', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      regDays: 1,
      offDays: 0,
      meal: 0,
    });
    expect(parseAttendanceCell('x/2', 'Hành chính', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      regDays: 0.5,
      offDays: 0.5,
    });
    expect(parseAttendanceCell('6.25', 'Hành chính', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      regDays: 6.25 / 8,
    });
    expect(parseAttendanceCell('C2+2', 'Ca 2', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      regDays: 1,
      ot15: 2,
      meal: 20000,
    });
    expect(parseAttendanceCell('C2/2-0.75', 'Ca 2', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      regDays: 0.5,
      offDays: 0.5,
      lateHours: 0.75,
      meal: 20000,
    });
    expect(parseAttendanceCell('K+2TK', 'Ca 1', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      regDays: 1,
      ot15: 2,
      meal: 15000,
    });
    expect(parseAttendanceCell('VS+2', 'Ca 1', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      regDays: 1,
      ot15: 2,
      meal: 15000,
    });
    expect(parseAttendanceCell('C3+2D', 'Ca 3', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      regDays: 1,
      s3Days: 1,
      ot30: 2,
      meal: 20000,
    });
    // X/2+O/2 -> worked half day + personal leave half day -> offDays MUST be 0.5 (not double counted to 1.0)
    expect(parseAttendanceCell('X/2+O/2', 'Hành chính', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      regDays: 0.5,
      abExtra: 0.5,
      offDays: 0.5,
    });
    expect(parseAttendanceCell('P', 'Ca 1', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      pDays: 1,
      offDays: 1,
    });
    expect(parseAttendanceCell('KP', 'Ca 1', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      kpDays: 1,
      offDays: 1,
    });
    expect(parseAttendanceCell('0', 'Ca 1', DEFAULT_MEAL_CONFIG, false)).toMatchObject({
      offDays: 1,
      abExtra: 1,
    });
    expect(parseAttendanceCell('C1', 'Ca 1', DEFAULT_MEAL_CONFIG, true)).toMatchObject({
      regDays: 0,
      ot20: 8,
      meal: 30000,
    });
  });

  it('computes offDays dynamically on active days instead of subtracting hardcoded 27 early in month or in Feb', () => {
    // Early in Feb 2026 (28 days): only first 5 days recorded (Feb 1 is Sun, Feb 2..5 are Mon..Thu = 4 work days)
    const days = new Array(31).fill('');
    days[1] = 'X';
    days[2] = 'X';
    days[3] = 'X';
    days[4] = 'X';
    const emp: AttendanceRow = {
      empId: 'NV00053',
      name: 'Hoàng Ngọc Hà',
      workType: 'Công',
      defaultShift: 'Hành chính',
      yearDaysHist: [24, 0, 0, 0, 0, 0, 0, 0, 0],
      days,
    };
    const stats = computeEmployeeMonthlyStats(emp, 2026, 2, DEFAULT_MEAL_CONFIG, '2026-02-05');
    expect(stats.daysInMonth).toBe(28);
    expect(stats.regDays).toBe(4);
    expect(stats.offDays).toBe(0);
    expect(stats.grade).toBe('A');
  });

  it('computes consolidated 3P monthly payroll across piecework & monthly staff', () => {
    const days = new Array(31).fill('');
    for (let i = 0; i < 25; i++) days[i] = 'C1';
    const attSummary = computeEmployeeMonthlyStats(
      {
        empId: 'NV00214',
        name: 'Trần Văn Quỳnh',
        workType: 'Công',
        defaultShift: 'Ca 1',
        yearDaysHist: [25, 25, 25, 25, 25, 25, 25, 25, 25],
        days,
      },
      2026,
      10,
      DEFAULT_MEAL_CONFIG,
      '2026-10-25'
    );

    const rows = computeMonthly3PPayroll(
      [
        {
          id: 'NV00214',
          name: 'Trần Văn Quỳnh',
          username: 'quynh',
          role: 'CN',
          appRole: 'WORKER',
          title: 'Công nhân',
          salaryMode: 'Khoán 1 + 0.33 máy',
          baseSalary: 400000,
          costPerSec: 13.89,
          isLinked: false,
        },
      ],
      [attSummary],
      [
        {
          workerId: 'NV00214',
          logCount: 20,
          earnedStdSeconds: 180 * 3600,
          directPieceIncome: 9_500_000,
          waitWageTotal: 200_000,
          otBonusTotal: 300_000,
          logMealTotal: 150_000,
          scrapPenaltyTotal: 50_000,
        },
      ]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].p3PerformancePay).toBe(9_500_000);
    expect(rows[0].scrapPenalty).toBe(50_000);
    expect(rows[0].netPay).toBeGreaterThan(9_500_000);
  });
});
