import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  sanitizeForExcel,
  buildAttendanceWorkbook,
  buildCostingPnlWorkbook,
  buildDailyLogsWorkbook,
  buildOperationsTemplateWorkbook,
  parseOperationsWorkbookBuffer,
} from '../../src/client/lib/excelService';
import {
  computeEmployeeMonthlyStats,
  computeMonthDows,
  DEFAULT_MEAL_CONFIG,
} from '../../src/shared/attendanceParser';
import type {
  AttendanceRow,
  ProductCostingSummary,
  ProductionLogDto,
} from '../../src/shared/types';

async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as any);
  return wb;
}

describe('excelService — Formula Injection Guard & 4 Industrial Excel Workbooks', () => {
  it('guards against formula injection (=, @, +CMD) while keeping attendance codes (+2, -1.5, C2+2) as pure text', async () => {
    expect(sanitizeForExcel('=CMD|\' /C calc\'!A0')).toBe('\'=CMD|\' /C calc\'!A0');
    expect(sanitizeForExcel('@SUM(A1:A10)')).toBe('\'@SUM(A1:A10)');
    expect(sanitizeForExcel('+SUM(A1:A2)')).toBe('\'+SUM(A1:A2)');
    expect(sanitizeForExcel('-HYPERLINK("http://evil")')).toBe('\'-HYPERLINK("http://evil")');

    // Legitimate GCCK attendance & mechanical strings MUST remain pure text without leading quote
    expect(sanitizeForExcel('+2')).toBe('+2');
    expect(sanitizeForExcel('-1.5')).toBe('-1.5');
    expect(sanitizeForExcel('C2+2')).toBe('C2+2');
    expect(sanitizeForExcel('C2/2-0.75')).toBe('C2/2-0.75');
    expect(sanitizeForExcel('16335 Body-8\'\', JP')).toBe('16335 Body-8\'\', JP');
    expect(sanitizeForExcel(125000)).toBe(125000);
  });

  it('builds Attendance workbook with all 4 sheets and stores +2 / -1.5 / C2+2 as String cells (never Formula)', async () => {
    const days = new Array(31).fill('');
    days[0] = '+2';
    days[1] = '-1.5';
    days[2] = 'C2+2';
    days[3] = '=EVIL()';
    days[4] = 'KP';

    const rawEmp: AttendanceRow = {
      empId: 'NV00214',
      name: '=Trần Văn Quỳnh',
      workType: 'Công',
      defaultShift: 'Ca 2',
      yearDaysHist: [24, 23, 25, 24, 25, 24, 25, 24, 25],
      days,
    };

    const empStats = computeEmployeeMonthlyStats(rawEmp, 2026, 10, DEFAULT_MEAL_CONFIG, '2026-10-26');
    const dows = computeMonthDows(2026, 10);

    const bytes = await buildAttendanceWorkbook({
      yearMonth: '2026-10',
      dows,
      employees: [empStats],
    });

    const wb = await loadWorkbook(bytes);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      '1_BANG_NHAP_THANG',
      '2_TONG_HOP_CONG_TC',
      '3_PHU_CAP_AN_CA',
      '4_TONG_HOP_NAM_12T',
    ]);

    const s1 = wb.getWorksheet('1_BANG_NHAP_THANG')!;
    expect(s1.getRow(1).cellCount).toBe(36);
    const dataRow = s1.getRow(3);
    // Name starting with '=' is prefixed with "'"
    expect(dataRow.getCell(3).value).toBe("'=Trần Văn Quỳnh");

    // Day 01 (+2), Day 02 (-1.5), Day 03 (C2+2) remain pure String cells, NOT formulas
    const cellDay1 = dataRow.getCell(6);
    const cellDay2 = dataRow.getCell(7);
    const cellDay3 = dataRow.getCell(8);
    const cellDay4 = dataRow.getCell(9);

    expect(cellDay1.value).toBe('+2');
    expect(cellDay1.type).toBe(ExcelJS.ValueType.String);
    expect(cellDay1.formula).toBeUndefined();

    expect(cellDay2.value).toBe('-1.5');
    expect(cellDay2.type).toBe(ExcelJS.ValueType.String);
    expect(cellDay2.formula).toBeUndefined();

    expect(cellDay3.value).toBe('C2+2');
    expect(cellDay3.type).toBe(ExcelJS.ValueType.String);
    expect(cellDay3.formula).toBeUndefined();

    expect(cellDay4.value).toBe("'=EVIL()");
    expect(cellDay4.type).toBe(ExcelJS.ValueType.String);

    const s2 = wb.getWorksheet('2_TONG_HOP_CONG_TC')!;
    expect(s2.getRow(1).cellCount).toBe(16);

    const s3 = wb.getWorksheet('3_PHU_CAP_AN_CA')!;
    expect(s3.getRow(1).cellCount).toBe(35);

    const s4 = wb.getWorksheet('4_TONG_HOP_NAM_12T')!;
    expect(s4.getRow(1).cellCount).toBe(24);
  });

  it('builds 19-column Costing & P&L workbook accurately including anti-fake-profit WIP product', async () => {
    const items: ProductCostingSummary[] = [
      {
        spId: 'SP095',
        customer: 'Vico - Nội bộ',
        productName: '@Búa đập VHC-111',
        opCount: 2,
        opsSummary: 'NC1: Phay thô → NC2: Phay tinh',
        totalSec: 5400,
        totalHours: 1.5,
        stdLabor: 75000,
        stdMach: 350000,
        stdTool: 50000,
        stdOverhead: 47500,
        rawMaterialCost: 120000,
        outsourceCost: 30000,
        totalStdCost: 672500,
        quotedPrice: 800000,
        wipQty: 8,
        wipBatchCost: 1500000,
        finishedQty: 0,
        actualBatchCost: 0,
        actualUnitCost: 672500,
        unitProfit: 127500,
        totalBatchProfit: 0,
        marginPct: 15.9,
        hasActual: false,
        stepBreakdowns: [],
      },
    ];

    const bytes = await buildCostingPnlWorkbook(items);
    const wb = await loadWorkbook(bytes);
    const ws = wb.getWorksheet('BAO_GIA_LO_LAI_SP')!;
    expect(ws).toBeDefined();
    expect(ws.getRow(1).cellCount).toBe(19);

    const r2 = ws.getRow(2);
    expect(r2.getCell(1).value).toBe('SP095');
    expect(r2.getCell(3).value).toBe("'@Búa đập VHC-111");
    expect(r2.getCell(14).value).toBe(0); // finishedQty === 0
    expect(r2.getCell(17).value).toBe(0); // totalBatchProfit === 0
    expect(r2.getCell(19).value).toBe('LÃI TỐT');
  });

  it('builds 17-column Daily Production Logs workbook with formula-injection protection', async () => {
    const logs: ProductionLogDto[] = [
      {
        id: 1,
        recordUid: 'GCCK-20261026-ABCD1234',
        createdAt: '2026-10-26 14:05:00',
        timeStr: '26/10 14:05',
        workDate: '2026-10-26',
        shiftType: 'Ca 1 (Sáng 06h-14h)',
        startTime: '06:00',
        endTime: '14:00',
        overtimeMinutes: 0,
        isSunday: 0,
        isLightsOut: 0,
        workerId: 'NV00214',
        workerName: 'Trần Văn Quỳnh',
        machineId: 'M02',
        machineName: 'Máy Tiện CNC 1',
        machineMode: 'FIRST',
        poId: 'PO485-01',
        spId: 'SP001',
        customer: 'Win-Win',
        productName: '16335 Body-8\'\', JP',
        ncId: 'NC001',
        opName: 'NC1: Tiện mặt đầu',
        stage: 'End',
        stepOrder: 1,
        isFinalOp: 1,
        stdSeconds: 1800,
        okQty: 12,
        reworkQty: 1,
        scrapQty: 0,
        defectType: '',
        damageValue: 0,
        stopMinutes: 15,
        stopReason: 'Chờ phôi',
        toolCode: 'T01',
        edgesUsed: 2,
        selfCheckOk: 1,
        qcStatus: 'PASSED',
        pieceWage: 300000,
        otBonusWage: 0,
        waitWage: 12500,
        mealAllowance: 0,
        scrapPenalty: 0,
        income: 312500,
        directPieceIncome: 312500,
        batchCost: 980000,
        kpiPct: 105,
        kpiStatus: 'Vượt ĐM (105%)',
        photoUrl: '',
        handoverNote: '=SUM(1,2)',
        materialLot: 'LOT-01',
        isVoided: 0,
        note: '=SUM(1,2)',
      },
    ];

    const bytes = await buildDailyLogsWorkbook(logs);
    const wb = await loadWorkbook(bytes);
    const ws = wb.getWorksheet('NHAT_KY_SAN_LUONG')!;
    expect(ws).toBeDefined();
    expect(ws.getRow(1).cellCount).toBe(17);

    const r2 = ws.getRow(2);
    expect(r2.getCell(8).value).toBe('16335 Body-8\'\', JP');
    expect(r2.getCell(11).value).toBe(12);
    expect(r2.getCell(15).value).toBe(312500);
    expect(r2.getCell(17).value).toBe("'=SUM(1,2)");
  });

  it('generates and parses 7-column Master Operations Excel template round-trip via exceljs', async () => {
    const templateBytes = await buildOperationsTemplateWorkbook();
    const wb = await loadWorkbook(templateBytes);
    const ws = wb.getWorksheet('MAU_NAP_NGUYEN_CONG')!;
    expect(ws).toBeDefined();
    expect(ws.getRow(1).cellCount).toBe(7);

    // Add a custom row with Vietnamese NFD text & special mechanical symbols to verify round-trip
    ws.addRow([
      'Vico - QLTB',
      'Căn Xe goong hồi bi Φ16x150mm',
      'NC3: Doa lỗ đạt ±0.01mm',
      2100,
      'End',
      'Máy Phay CNC 1',
      'T05',
    ]);
    const modifiedBuffer = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const parsed = await parseOperationsWorkbookBuffer(modifiedBuffer);
    expect(parsed.length).toBeGreaterThanOrEqual(3);

    const custom = parsed[parsed.length - 1];
    expect(custom.customer).toBe('Vico - QLTB');
    // NFC normalized!
    expect(custom.productName).toBe('Căn Xe goong hồi bi Φ16x150mm');
    expect(custom.opName).toBe('NC3: Doa lỗ đạt ±0.01mm');
    expect(custom.stdSeconds).toBe(2100);
    expect(custom.stage).toBe('End');
    expect(custom.defaultMachine).toBe('Máy Phay CNC 1');
    expect(custom.toolCode).toBe('T05');
  });

  it('builds Daily Schedule VICO BM01 Excel workbook with title, 10 columns and summary totals', async () => {
    const { buildDailyScheduleWorkbook } = await import('../../src/client/lib/excelService');
    const sampleRows = [
      {
        workDate: '2026-10-28',
        shiftType: 'Ca 2',
        stt: 1,
        workerName: 'Phùng Gia Phúc',
        customer: 'Thysen',
        productName: 'Sealing strip, below',
        opName: 'G/c NC3 kích thước 412mm',
        plannedQty: 20,
        machineName: 'Máy Phay CNC1',
        note: 'Tăng ca 2h',
        actualQty: 18,
        status: 'IN_PROGRESS',
      },
    ];

    const bytes = await buildDailyScheduleWorkbook('2026-10-28', sampleRows as any);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(1000);

    const wb = await loadWorkbook(bytes);
    const ws = wb.getWorksheet('KE_HOACH_NGAY')!;
    expect(ws).toBeDefined();

    // Check title in row 2
    expect(String(ws.getRow(2).getCell(1).value)).toContain('KẾ HOẠCH SẢN XUẤT NGÀY 28/10/2026');

    // Check headers in row 4
    expect(ws.getRow(4).getCell(1).value).toBe('STT');
    expect(ws.getRow(4).getCell(2).value).toBe('Ca Làm Việc');
    expect(ws.getRow(4).getCell(3).value).toBe('Người Thực Hiện (Thợ)');
    expect(ws.getRow(4).getCell(7).value).toBe('Số Lượng Kế Hoạch');

    // Check data row 5
    expect(ws.getRow(5).getCell(3).value).toBe('Phùng Gia Phúc');
    expect(ws.getRow(5).getCell(7).value).toBe(20);
  });
});
