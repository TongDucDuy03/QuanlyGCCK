import { describe, it, expect } from 'vitest';
import type { OperationMeta, PurchaseOrderInfo } from '../../src/shared/types';
import {
  parseTravelerQrPayload,
  resolveQrToShopfloorSelection,
  createInitialStopTimerState,
  startPersistentStopTimer,
  pausePersistentStopTimer,
  resetPersistentStopTimer,
  computeStopTimerElapsed,
  syncAutoToolEdges,
  applyManualToolEdges,
  estimateScrapDamageValue,
  getShiftPresetTimes,
} from '../../src/client/features/worker/shopfloorHelpers';
import * as formattersModule from '../../src/client/lib/formatters';
import * as syncAdaptersModule from '../../src/server/adapters/syncAdapters';

describe('shopfloorHelpers — QR Traveler Parser, Persistent Stop Timer & Dirty Tool Edges', () => {
  describe('parseTravelerQrPayload', () => {
    it('parses standard 3-segment GCCK|PO485-01|NC158 traveler QR payload', () => {
      const parsed = parseTravelerQrPayload('GCCK|PO485-01|NC158');
      expect(parsed).toEqual({
        valid: true,
        poId: 'PO485-01',
        ncId: 'NC158',
        raw: 'GCCK|PO485-01|NC158',
      });
    });

    it('normalizes extra spaces and lowercase prefix in QR payload', () => {
      const parsed = parseTravelerQrPayload('  gcck | po485-01 | nc098  ');
      expect(parsed).toEqual({
        valid: true,
        poId: 'PO485-01',
        ncId: 'NC098',
        raw: 'gcck | po485-01 | nc098',
      });
    });

    it('parses 2-segment PO header QR payload GCCK|PO485-01', () => {
      const parsed = parseTravelerQrPayload('GCCK|PO485-01');
      expect(parsed).toEqual({
        valid: true,
        poId: 'PO485-01',
        ncId: null,
        raw: 'GCCK|PO485-01',
      });
    });

    it('extracts QR payload embedded inside a URL query or traveler path', () => {
      expect(parseTravelerQrPayload('https://mes.gcck.vn/worker?qr=GCCK%7CPO485-01%7CNC098')).toEqual({
        valid: true,
        poId: 'PO485-01',
        ncId: 'NC098',
        raw: 'https://mes.gcck.vn/worker?qr=GCCK%7CPO485-01%7CNC098',
      });
      expect(parseTravelerQrPayload('https://mes.gcck.vn/print/traveler/PO485-01')).toEqual({
        valid: true,
        poId: 'PO485-01',
        ncId: null,
        raw: 'https://mes.gcck.vn/print/traveler/PO485-01',
      });
    });

    it('rejects malformed or empty QR strings cleanly', () => {
      expect(parseTravelerQrPayload('')).toEqual({
        valid: false,
        poId: null,
        ncId: null,
        raw: '',
      });
      expect(parseTravelerQrPayload('RANDOM_BARCODE_12345')).toEqual({
        valid: false,
        poId: null,
        ncId: null,
        raw: 'RANDOM_BARCODE_12345',
      });
    });
  });

  describe('resolveQrToShopfloorSelection', () => {
    const sampleOrders: PurchaseOrderInfo[] = [
      {
        poId: 'PO485-01',
        customer: 'Win-Win',
        spId: 'SP058',
        productName: 'ALKTOP 1342 M',
        qtyPo: 90,
        dueDate: '2026-10-25',
        wipQty: 90,
        finishedQty: 84,
        deliveredQty: 0,
        stockQty: 84,
        remainQty: 90,
        status: '⚙️ Đang gia công',
      },
    ];

    const sampleOps: OperationMeta[] = [
      {
        ncId: 'NC098',
        spId: 'SP058',
        customer: 'Win-Win',
        productName: 'ALKTOP 1342 M',
        opName: 'G/c hoàn thiện',
        stdSeconds: 480,
        stage: '1',
        stepOrder: 1,
        isFinalOp: 0,
        defaultMachine: 'Máy Tiện CNC 1',
        matName: 'SCM440',
        cuttingRec: 'Vc=140-180m/p',
        toolCode: 'T03',
        toolName: 'Chíp tiện TNMG',
        costPerEdge: 20833,
        stdEdgesPerPcs: 0.22,
        stdLaborCost: 6418,
        stdMachCost: 46666,
        stdToolCost: 4583,
      },
      {
        ncId: 'NC158',
        spId: 'SP095',
        customer: 'Taniguchi',
        productName: 'Búa đập VHC-111',
        opName: 'G/c làm định vị',
        stdSeconds: 3600,
        stage: '1',
        stepOrder: 1,
        isFinalOp: 0,
        defaultMachine: 'Máy tiện FUJI',
        matName: 'SKD11',
        cuttingRec: 'Vc=90-120m/p',
        toolCode: 'T03',
        toolName: 'Chíp tiện TNMG',
        costPerEdge: 20833,
        stdEdgesPerPcs: 2.1,
        stdLaborCost: 48132,
        stdMachCost: 349992,
        stdToolCost: 43750,
      },
    ];

    it('resolves exact matching PO + NC pair directly', () => {
      const parsed = parseTravelerQrPayload('GCCK|PO485-01|NC098');
      const resolved = resolveQrToShopfloorSelection(parsed, sampleOrders, sampleOps);
      expect(resolved).toMatchObject({
        poId: 'PO485-01',
        ncId: 'NC098',
        spId: 'SP058',
        customer: 'Win-Win',
        productName: 'ALKTOP 1342 M',
        defaultMachine: 'Máy Tiện CNC 1',
        toolCode: 'T03',
        reconciledWarning: null,
      });
    });

    it('selects step-1 operation automatically when scanning PO header QR without NC', () => {
      const parsed = parseTravelerQrPayload('GCCK|PO485-01');
      const resolved = resolveQrToShopfloorSelection(parsed, sampleOrders, sampleOps);
      expect(resolved?.poId).toBe('PO485-01');
      expect(resolved?.ncId).toBe('NC098');
      expect(resolved?.reconciledWarning).toBeNull();
    });

    it('reconciles mismatched PO and NC safely to PO-THEO-KH so submission never fails validation', () => {
      const parsed = parseTravelerQrPayload('GCCK|PO485-01|NC158');
      const resolved = resolveQrToShopfloorSelection(parsed, sampleOrders, sampleOps);
      expect(resolved?.ncId).toBe('NC158');
      expect(resolved?.poId).toBe('PO-THEO-KH');
      expect(resolved?.defaultMachine).toBe('Máy tiện FUJI');
      expect(resolved?.reconciledWarning).toContain('NC158');
    });
  });

  describe('Persistent Stop-Machine Timer (Date.now() - startedAt)', () => {
    it('tracks elapsed time across phone screen lock using Date.now() - startedAt', () => {
      const t0 = 1_700_000_000_000;
      const initial = createInitialStopTimerState();
      const running = startPersistentStopTimer(initial, t0);

      expect(running.isRunning).toBe(true);
      expect(running.startedAt).toBe(t0);

      // 27 minutes and 35 seconds later while phone screen was off
      const later = t0 + (27 * 60 + 35) * 1000;
      const snap = computeStopTimerElapsed(running, later);
      expect(snap.elapsedSeconds).toBe(27 * 60 + 35);
      expect(snap.elapsedMinutes).toBe(28); // rounded to nearest minute (>=1m when active)
      expect(snap.formattedClock).toBe('27:35');
    });

    it('accumulates multiple pause/resume intervals accurately and resets cleanly', () => {
      const t0 = 1_700_000_000_000;
      let state = startPersistentStopTimer(createInitialStopTimerState(), t0);

      // Pause after 10 minutes
      state = pausePersistentStopTimer(state, t0 + 10 * 60 * 1000);
      expect(state.isRunning).toBe(false);
      expect(computeStopTimerElapsed(state, t0 + 99 * 60 * 1000).elapsedSeconds).toBe(600);

      // Resume at +20m and run 5 more minutes (total 15m = 900s)
      state = startPersistentStopTimer(state, t0 + 20 * 60 * 1000);
      const snap = computeStopTimerElapsed(state, t0 + 25 * 60 * 1000);
      expect(snap.elapsedSeconds).toBe(900);
      expect(snap.elapsedMinutes).toBe(15);
      expect(snap.formattedClock).toBe('15:00');

      const reset = resetPersistentStopTimer();
      expect(computeStopTimerElapsed(reset, t0 + 30 * 60 * 1000)).toEqual({
        elapsedSeconds: 0,
        elapsedMinutes: 0,
        formattedClock: '00:00',
      });
    });

    it('formats durations >= 1 hour as HH:MM:SS', () => {
      const t0 = 1_700_000_000_000;
      const running = startPersistentStopTimer(createInitialStopTimerState(), t0);
      const snap = computeStopTimerElapsed(running, t0 + (1 * 3600 + 5 * 60 + 9) * 1000);
      expect(snap.formattedClock).toBe('01:05:09');
      expect(snap.elapsedMinutes).toBe(65);
    });
  });

  describe('isEdgesDirty — Tool Edge Consumption Auto-Calc vs Manual Override', () => {
    it('auto-calculates edgesUsed = okQty * stdEdgesPerPcs when isEdgesDirty is false', () => {
      const s1 = syncAutoToolEdges({ edgesUsed: 0, isEdgesDirty: false }, 10, 0.22);
      expect(s1).toEqual({ edgesUsed: 2.2, isEdgesDirty: false });

      const s2 = syncAutoToolEdges(s1, 15, 0.22);
      expect(s2).toEqual({ edgesUsed: 3.3, isEdgesDirty: false });
    });

    it('does NOT overwrite manual edgesUsed when okQty changes while isEdgesDirty is true', () => {
      const autoState = syncAutoToolEdges({ edgesUsed: 0, isEdgesDirty: false }, 10, 0.22);
      const manualState = applyManualToolEdges(autoState, 4);
      expect(manualState).toEqual({ edgesUsed: 4, isEdgesDirty: true });

      // Worker increments okQty from 10 -> 25; manual 4 edges must remain untouched!
      const afterQtyChange = syncAutoToolEdges(manualState, 25, 0.22);
      expect(afterQtyChange).toEqual({ edgesUsed: 4, isEdgesDirty: true });
    });

    it('resets isEdgesDirty and recalculates when forceReset is passed (e.g. operation changed)', () => {
      const dirtyState = { edgesUsed: 4, isEdgesDirty: true };
      const resetState = syncAutoToolEdges(dirtyState, 8, 2.1, true);
      expect(resetState).toEqual({ edgesUsed: 16.8, isEdgesDirty: false });
    });
  });

  describe('estimateScrapDamageValue & getShiftPresetTimes', () => {
    it('estimates scrap damage value from standard op labor + machine + tool cost', () => {
      expect(
        estimateScrapDamageValue(2, {
          stdLaborCost: 10000,
          stdMachCost: 40000,
          stdToolCost: 5000,
        })
      ).toBe(110000);
    });

    it('returns accurate shift preset start and end times', () => {
      expect(getShiftPresetTimes('Ca 1 (Sáng 06h-14h)')).toEqual({
        startTime: '06:00',
        endTime: '14:00',
      });
      expect(getShiftPresetTimes('Ca 2 (Chiều 14h-22h)')).toEqual({
        startTime: '14:00',
        endTime: '22:00',
      });
      expect(getShiftPresetTimes('Ca 3 (Đêm 22h-06h)')).toEqual({
        startTime: '22:00',
        endTime: '06:00',
      });
      expect(getShiftPresetTimes('Ca Hành chính (07h30-16h30)')).toEqual({
        startTime: '07:30',
        endTime: '16:30',
      });
    });
  });

  describe('Dual-Schema FAI Measured Dimensions & Telegram HTML Escaping', () => {
    it('normalizes both Worker FAI ({ dim, spec, measured, ok }) and Admin QC ({ feature, nominal, tolPlusMinus, measured, pass }) schemas', () => {
      const normalizeQcMeasuredDims = (formattersModule as any).normalizeQcMeasuredDims;
      expect(typeof normalizeQcMeasuredDims).toBe('function');

      const faiDims = normalizeQcMeasuredDims(
        JSON.stringify([
          { dim: 'Đường kính lỗ chính', spec: 'Φ120 H7 (+0.035/0)', measured: '120.018', ok: true },
          { dim: 'Độ nhám bề mặt', spec: 'Ra 1.6', measured: 'Ra 1.2', ok: true },
        ])
      );
      expect(faiDims).toEqual([
        {
          label: 'Đường kính lỗ chính',
          specText: 'Φ120 H7 (+0.035/0)',
          measuredText: '120.018',
          ok: true,
        },
        {
          label: 'Độ nhám bề mặt',
          specText: 'Ra 1.6',
          measuredText: 'Ra 1.2',
          ok: true,
        },
      ]);

      const adminDims = normalizeQcMeasuredDims(
        JSON.stringify([
          { feature: 'Đường kính lỗ tinh Ø', nominal: 40, tolPlusMinus: 0.01, measured: 40.004, pass: true },
          { feature: 'Chiều dày bậc vai L', nominal: 25, tolPlusMinus: 0.01, measured: 25.05, pass: false },
        ])
      );
      expect(adminDims).toEqual([
        {
          label: 'Đường kính lỗ tinh Ø',
          specText: '40±0.01',
          measuredText: '40.004',
          ok: true,
        },
        {
          label: 'Chiều dày bậc vai L',
          specText: '25±0.01',
          measuredText: '25.05',
          ok: false,
        },
      ]);
    });

    it('escapes &, <, > in dynamic Telegram receipt text before sending with parse_mode: HTML', () => {
      const escapeTelegramHtml = (syncAdaptersModule as any).escapeTelegramHtml;
      expect(typeof escapeTelegramHtml).toBe('function');
      expect(escapeTelegramHtml('Bích <Ø120> & Lô #5 > 3')).toBe(
        'Bích &lt;Ø120&gt; &amp; Lô #5 &gt; 3'
      );
    });
  });
});
