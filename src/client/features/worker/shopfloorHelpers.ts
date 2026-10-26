import type { OperationMeta, PurchaseOrderInfo } from '@shared/types';
import { normalizeVn, removeVietnameseTones } from '@shared/vnSearch';

export interface ParsedTravelerQr {
  valid: boolean;
  poId: string | null;
  ncId: string | null;
  raw: string;
}

export interface ResolvedQrSelection {
  poId: string;
  ncId: string;
  spId: string | null;
  customer: string;
  productName: string;
  defaultMachine: string;
  toolCode: string;
  reconciledWarning: string | null;
}

export interface StopTimerState {
  isRunning: boolean;
  startedAt: number | null;
  accumulatedMs: number;
}

export interface StopTimerSnapshot {
  elapsedSeconds: number;
  elapsedMinutes: number;
  formattedClock: string;
}

export interface ToolEdgesState {
  edgesUsed: number;
  isEdgesDirty: boolean;
}

export const STOP_TIMER_STORAGE_KEY = 'GCCK_PERSISTENT_STOP_TIMER_V1';
export const RUN_TIMER_STORAGE_KEY = 'GCCK_PERSISTENT_RUN_TIMER_V1';

/**
 * Parses GCCK Shop Traveler QR strings:
 * - GCCK|<poId>|<ncId>
 * - GCCK|<poId>
 * - URLs containing ?qr=GCCK|... or /print/traveler/<poId>
 */
export function parseTravelerQrPayload(rawInput: string | null | undefined): ParsedTravelerQr {
  const raw = String(rawInput ?? '').trim();
  if (!raw) {
    return { valid: false, poId: null, ncId: null, raw: '' };
  }

  let candidate = raw;
  try {
    if (raw.includes('://') || raw.startsWith('/')) {
      const urlObj = new URL(raw, 'https://mes.gcck.local');
      const qrParam = urlObj.searchParams.get('qr');
      if (qrParam) {
        candidate = decodeURIComponent(qrParam).trim();
      } else {
        const travelerMatch = /\/print\/traveler\/([^/?#]+)/i.exec(urlObj.pathname);
        if (travelerMatch) {
          const poId = normalizeVn(decodeURIComponent(travelerMatch[1])).toUpperCase();
          return poId
            ? { valid: true, poId, ncId: null, raw }
            : { valid: false, poId: null, ncId: null, raw };
        }
      }
    }
  } catch {
    // Fallback to direct string parsing
  }

  const parts = candidate.split('|').map((s) => normalizeVn(s));
  if (parts.length >= 2 && parts[0].toUpperCase() === 'GCCK') {
    const poId = parts[1] ? parts[1].toUpperCase() : null;
    const ncId = parts[2] ? parts[2].toUpperCase() : null;
    if (poId) {
      return { valid: true, poId, ncId: ncId || null, raw };
    }
  }

  return { valid: false, poId: null, ncId: null, raw };
}

/**
 * Resolves a parsed QR code against live PurchaseOrders & Operations,
 * reconciling mismatched PO/NC pairs safely so report submission never fails DB validation.
 */
export function resolveQrToShopfloorSelection(
  parsed: ParsedTravelerQr,
  orders: PurchaseOrderInfo[],
  operations: OperationMeta[]
): ResolvedQrSelection | null {
  if (!parsed.valid || !parsed.poId) return null;

  const matchedPo =
    parsed.poId === 'PO-THEO-KH'
      ? null
      : orders.find((o) => o.poId.toUpperCase() === parsed.poId!.toUpperCase()) ?? null;

  const matchedOp = parsed.ncId
    ? operations.find((op) => op.ncId.toUpperCase() === parsed.ncId!.toUpperCase()) ?? null
    : null;

  if (matchedOp) {
    // Exact or compatible PO + NC
    if (parsed.poId === 'PO-THEO-KH') {
      return {
        poId: 'PO-THEO-KH',
        ncId: matchedOp.ncId,
        spId: matchedOp.spId,
        customer: matchedOp.customer,
        productName: matchedOp.productName,
        defaultMachine: matchedOp.defaultMachine,
        toolCode: matchedOp.toolCode,
        reconciledWarning: null,
      };
    }

    if (matchedPo && (!matchedPo.spId || matchedPo.spId === matchedOp.spId)) {
      return {
        poId: matchedPo.poId,
        ncId: matchedOp.ncId,
        spId: matchedOp.spId,
        customer: matchedOp.customer,
        productName: matchedOp.productName,
        defaultMachine: matchedOp.defaultMachine,
        toolCode: matchedOp.toolCode,
        reconciledWarning: null,
      };
    }

    // Mismatched PO vs Operation -> find an open PO for this Operation's spId, else fallback to PO-THEO-KH
    const compatiblePo = orders.find((o) => o.spId && o.spId === matchedOp.spId && o.remainQty > 0);
    const resolvedPoId = compatiblePo ? compatiblePo.poId : 'PO-THEO-KH';
    return {
      poId: resolvedPoId,
      ncId: matchedOp.ncId,
      spId: matchedOp.spId,
      customer: matchedOp.customer,
      productName: matchedOp.productName,
      defaultMachine: matchedOp.defaultMachine,
      toolCode: matchedOp.toolCode,
      reconciledWarning: `Mã nguyên công ${matchedOp.ncId} thuộc SP "${matchedOp.productName}" — đã đồng bộ Lệnh SX sang ${resolvedPoId}.`,
    };
  }

  // PO-only header QR -> pick step 1 operation of that PO
  if (matchedPo) {
    const prodOps = matchedPo.spId
      ? operations
          .filter((o) => o.spId === matchedPo.spId)
          .sort((a, b) => a.stepOrder - b.stepOrder)
      : operations.filter(
          (o) =>
            normalizeVn(o.productName).replace(/\s+/g, '').toUpperCase() ===
            normalizeVn(matchedPo.productName).replace(/\s+/g, '').toUpperCase()
        );

    const firstOp = prodOps[0];
    if (firstOp) {
      return {
        poId: matchedPo.poId,
        ncId: firstOp.ncId,
        spId: firstOp.spId,
        customer: firstOp.customer,
        productName: firstOp.productName,
        defaultMachine: firstOp.defaultMachine,
        toolCode: firstOp.toolCode,
        reconciledWarning: null,
      };
    }
  }

  return null;
}

export function createInitialStopTimerState(): StopTimerState {
  return {
    isRunning: false,
    startedAt: null,
    accumulatedMs: 0,
  };
}

export function startPersistentStopTimer(
  prev: StopTimerState,
  nowMs: number = Date.now()
): StopTimerState {
  if (prev.isRunning && prev.startedAt !== null) return prev;
  return {
    isRunning: true,
    startedAt: nowMs,
    accumulatedMs: Math.max(0, Number(prev.accumulatedMs) || 0),
  };
}

export function pausePersistentStopTimer(
  prev: StopTimerState,
  nowMs: number = Date.now()
): StopTimerState {
  if (!prev.isRunning || prev.startedAt === null) return prev;
  const delta = Math.max(0, nowMs - prev.startedAt);
  return {
    isRunning: false,
    startedAt: null,
    accumulatedMs: Math.max(0, Number(prev.accumulatedMs) || 0) + delta,
  };
}

export function resetPersistentStopTimer(): StopTimerState {
  return createInitialStopTimerState();
}

export function computeStopTimerElapsed(
  state: StopTimerState,
  nowMs: number = Date.now()
): StopTimerSnapshot {
  const baseMs = Math.max(0, Number(state.accumulatedMs) || 0);
  const liveMs =
    state.isRunning && state.startedAt !== null ? Math.max(0, nowMs - state.startedAt) : 0;
  const totalMs = baseMs + liveMs;
  const elapsedSeconds = Math.floor(totalMs / 1000);
  const elapsedMinutes =
    elapsedSeconds === 0 ? 0 : Math.max(1, Math.round(elapsedSeconds / 60));

  const hrs = Math.floor(elapsedSeconds / 3600);
  const mins = Math.floor((elapsedSeconds % 3600) / 60);
  const secs = elapsedSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedClock =
    hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;

  return {
    elapsedSeconds,
    elapsedMinutes,
    formattedClock,
  };
}

export function loadStopTimerFromStorage(key: string = STOP_TIMER_STORAGE_KEY): StopTimerState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return createInitialStopTimerState();
    const parsed = JSON.parse(raw);
    return {
      isRunning: Boolean(parsed?.isRunning),
      startedAt: typeof parsed?.startedAt === 'number' ? parsed.startedAt : null,
      accumulatedMs: Math.max(0, Number(parsed?.accumulatedMs) || 0),
    };
  } catch {
    return createInitialStopTimerState();
  }
}

export function saveStopTimerToStorage(
  state: StopTimerState,
  key: string = STOP_TIMER_STORAGE_KEY
): void {
  try {
    if (!state.isRunning && state.accumulatedMs === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(state));
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Recalculates tool edges consumed automatically ONLY when isEdgesDirty is false
 * (or when forceReset is true, e.g. switching operation).
 */
export function syncAutoToolEdges(
  current: ToolEdgesState,
  okQty: number,
  stdEdgesPerPcs: number,
  forceReset: boolean = false
): ToolEdgesState {
  if (!forceReset && current.isEdgesDirty) {
    return current;
  }
  const safeQty = Math.max(0, Number(okQty) || 0);
  const safeStd = Math.max(0, Number(stdEdgesPerPcs) || 0);
  const calculated = Number((safeQty * safeStd).toFixed(2));
  return {
    edgesUsed: calculated,
    isEdgesDirty: false,
  };
}

export function applyManualToolEdges(
  _current: ToolEdgesState,
  manualEdges: number
): ToolEdgesState {
  const safeManual = Math.max(0, Number(Number(manualEdges || 0).toFixed(2)));
  return {
    edgesUsed: safeManual,
    isEdgesDirty: true,
  };
}

export function estimateScrapDamageValue(
  scrapQty: number,
  op: Pick<OperationMeta, 'stdLaborCost' | 'stdMachCost' | 'stdToolCost'> | null | undefined
): number {
  const qty = Math.max(0, Math.round(Number(scrapQty) || 0));
  if (qty <= 0 || !op) return 0;
  const unitStdCost =
    Math.max(0, Number(op.stdLaborCost) || 0) +
    Math.max(0, Number(op.stdMachCost) || 0) +
    Math.max(0, Number(op.stdToolCost) || 0);
  return Math.round(qty * Math.max(50000, unitStdCost));
}

export function getShiftPresetTimes(shiftType: string): { startTime: string; endTime: string } {
  const ascii = removeVietnameseTones(shiftType || '').toLowerCase();
  if (ascii.includes('ca 2')) {
    return { startTime: '14:00', endTime: '22:00' };
  }
  if (ascii.includes('ca 3')) {
    return { startTime: '22:00', endTime: '06:00' };
  }
  if (ascii.includes('hanh chinh')) {
    return { startTime: '07:30', endTime: '16:30' };
  }
  return { startTime: '06:00', endTime: '14:00' };
}
