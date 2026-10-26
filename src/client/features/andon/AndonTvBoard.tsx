import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  Award,
  Clock,
  Cpu,
  Flame,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Pin,
  PlayCircle,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import type { AndonLivePayload } from '@shared/types';
import { removeVietnameseTones } from '@shared/vnSearch';
import { apiClient } from '../../lib/apiClient';
import { formatDateVn, formatNumber } from '../../lib/formatters';
import { Badge } from '../../components/ui/IndustrialPrimitives';

type AndonDisplayMode = 'ALL_ZONES' | 'CAROUSEL';
type AndonSlideIndex = 0 | 1 | 2;

function getVietnamClockAndShift(now: Date): { clockStr: string; shiftLabel: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hh = parts.find((p) => p.type === 'hour')?.value ?? '08';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const ss = parts.find((p) => p.type === 'second')?.value ?? '00';
  const hourNum = Number(hh);

  let shiftLabel = 'CA 1 · SÁNG (06:00–14:00)';
  if (hourNum >= 14 && hourNum < 22) {
    shiftLabel = 'CA 2 · CHIỀU (14:00–22:00)';
  } else if (hourNum >= 22 || hourNum < 6) {
    shiftLabel = 'CA 3 · ĐÊM (22:00–06:00)';
  }

  return {
    clockStr: `${hh}:${mm}:${ss}`,
    shiftLabel,
  };
}

function resolveMachineVisualState(m: AndonLivePayload['machines'][number]): {
  badgeLabel: string;
  cardCls: string;
  pillCls: string;
  dotCls: string;
} {
  const stopAscii = removeVietnameseTones(m.stopReason || '').toLowerCase();
  const isWaitingMaterial =
    m.status === 'STOPPED' && (stopAscii.includes('cho phoi') || stopAscii.includes('cho cau'));

  if (m.status === 'RUNNING' && m.isLightsOut) {
    return {
      badgeLabel: '🟣 ĐÊM LIGHTS-OUT',
      cardCls: 'border-purple-500/70 bg-gradient-to-br from-purple-950/60 via-slate-900 to-slate-950',
      pillCls: 'border-purple-400/60 bg-purple-500/20 text-purple-200',
      dotCls: 'bg-purple-400 animate-pulse',
    };
  }

  if (m.status === 'RUNNING') {
    return {
      badgeLabel: '🟢 ĐANG CHẠY',
      cardCls: 'border-emerald-500/65 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950',
      pillCls: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200',
      dotCls: 'bg-emerald-400 animate-pulse',
    };
  }

  if (m.status === 'SETUP') {
    return {
      badgeLabel: '🟡 SETUP / ĐO KIỂM',
      cardCls: 'border-amber-500/70 bg-gradient-to-br from-amber-950/55 via-slate-900 to-slate-950',
      pillCls: 'border-amber-400/60 bg-amber-500/20 text-amber-200',
      dotCls: 'bg-amber-400',
    };
  }

  if (isWaitingMaterial) {
    return {
      badgeLabel: '🟣 CHỜ PHÔI / CẨU',
      cardCls: 'border-purple-500/70 bg-gradient-to-br from-purple-950/55 via-slate-900 to-slate-950',
      pillCls: 'border-purple-400/60 bg-purple-500/20 text-purple-200',
      dotCls: 'bg-purple-400',
    };
  }

  if (m.status === 'STOPPED' || m.status === 'MAINTENANCE') {
    return {
      badgeLabel: '🔴 DỪNG SỰ CỐ / HỎNG',
      cardCls: 'border-red-500/85 bg-gradient-to-br from-red-950/70 via-slate-900 to-slate-950 shadow-lg shadow-red-950/40',
      pillCls: 'border-red-400/70 bg-red-500/25 text-red-100',
      dotCls: 'bg-red-500 animate-ping',
    };
  }

  return {
    badgeLabel: '⚪ ĐANG NGHỈ',
    cardCls: 'border-slate-700/80 bg-slate-900/70',
    pillCls: 'border-slate-600 bg-slate-800 text-slate-300',
    dotCls: 'bg-slate-500',
  };
}

export function AndonTvBoard() {
  const [data, setData] = useState<AndonLivePayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [now, setNow] = useState<Date>(() => new Date());
  const [displayMode, setDisplayMode] = useState<AndonDisplayMode>('ALL_ZONES');
  const [slideIdx, setSlideIdx] = useState<AndonSlideIndex>(0);
  const [slidePinned, setSlidePinned] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const fetchAndon = useCallback(async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const payload = await apiClient.get<AndonLivePayload>('/andon/live', { timeoutMs: 9000 });
      setData(payload);
    } catch {
      // Keep last known live board on transient network hiccup
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll /andon/live every 10s
  useEffect(() => {
    void fetchAndon(false);
    const pollId = window.setInterval(() => {
      void fetchAndon(true);
    }, 10000);
    return () => window.clearInterval(pollId);
  }, [fetchAndon]);

  // Digital 1s clock
  useEffect(() => {
    const clockId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clockId);
  }, []);

  // Auto-carousel 15s rotation when in CAROUSEL mode and not pinned
  useEffect(() => {
    if (displayMode !== 'CAROUSEL' || slidePinned) return;
    const rotId = window.setInterval(() => {
      setSlideIdx((prev) => ((prev + 1) % 3) as AndonSlideIndex);
    }, 15000);
    return () => window.clearInterval(rotId);
  }, [displayMode, slidePinned]);

  // Sync fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore browser restriction
    }
  };

  const { clockStr, shiftLabel } = useMemo(() => getVietnamClockAndShift(now), [now]);

  const spindlePct = data?.spindleRunPct ?? 0;
  const machines = data?.machines ?? [];
  const urgentOrders = data?.urgentOrders ?? [];
  const leaderboard = data?.workerLeaderboard ?? [];
  const tickerItems = data?.alertsTicker ?? [
    'Đang đồng bộ tín hiệu trực tuyến từ phân xưởng GCCK Thắng Lợi...',
  ];

  const showZone1 = displayMode === 'ALL_ZONES' || slideIdx === 0;
  const showZone2 = displayMode === 'ALL_ZONES' || slideIdx === 1;
  const showZone3 = displayMode === 'ALL_ZONES' || slideIdx === 2;

  return (
    <div className="flex min-h-[calc(100vh-49px)] w-full max-w-full flex-col justify-between overflow-x-hidden bg-[#060911] text-slate-50">
      <div className="mx-auto w-full max-w-[1920px] flex-1 space-y-3 p-3 sm:p-4">
        {/* ==================== ISA-101 KIOSK HEADER ==================== */}
        <section className="rounded-2xl border border-industrial-border bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-3.5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Title & Live Shift */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#10b981]" />
                <h1 className="text-base font-black tracking-wider text-slate-50 sm:text-xl lg:text-2xl">
                  GCCK THẮNG LỢI — LIVE SHOPFLOOR ANDON
                </h1>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-sky-300 sm:text-sm">
                <span>{shiftLabel}</span>
                <span className="text-slate-600">|</span>
                <span className="font-mono-num text-slate-300">
                  Ngày {formatDateVn(data?.vietnamDate)}
                </span>
              </div>
            </div>

            {/* Key KPI Strip: Spindle Run-time %, Today OK / NG, Live Clock */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {/* Spindle Run-time % */}
              <div className="rounded-xl border border-emerald-500/40 bg-slate-950/90 px-3.5 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Spindle Run-time
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-mono-num tabular-nums text-xl font-black sm:text-2xl ${
                      spindlePct >= 60
                        ? 'text-emerald-400'
                        : spindlePct >= 35
                          ? 'text-amber-300'
                          : 'text-red-400'
                    }`}
                  >
                    {spindlePct}%
                  </span>
                  <span className="font-mono-num text-xs text-slate-400">
                    ({data?.summary.runningCount ?? 0}/{data?.summary.totalMachines ?? 0} máy)
                  </span>
                </div>
              </div>

              {/* Today OK / NG */}
              <div className="rounded-xl border border-industrial-border bg-slate-950/90 px-3.5 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sản lượng hôm nay
                </div>
                <div className="font-mono-num tabular-nums text-lg font-black sm:text-2xl">
                  <span className="text-emerald-400">
                    {formatNumber(data?.summary.todayOkQty ?? 0)} OK
                  </span>
                  <span className="mx-1.5 text-slate-600">/</span>
                  <span className="text-red-400">
                    {formatNumber(data?.summary.todayScrapQty ?? 0)} NG
                  </span>
                </div>
              </div>

              {/* Digital Clock HH:MM:SS */}
              <div className="rounded-xl border border-sky-500/40 bg-slate-950/90 px-3.5 py-2">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  <Clock className="h-3 w-3" /> Giờ Xưởng
                </div>
                <div
                  data-testid="andon-digital-clock"
                  className="font-mono-num tabular-nums text-xl font-black tracking-wider text-sky-200 sm:text-2xl"
                >
                  {clockStr}
                </div>
              </div>

              {/* Kiosk Controls */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setDisplayMode((m) => (m === 'ALL_ZONES' ? 'CAROUSEL' : 'ALL_ZONES'))
                  }
                  className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-colors ${
                    displayMode === 'CAROUSEL'
                      ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                      : 'border-sky-400/60 bg-sky-500/15 text-sky-200'
                  }`}
                >
                  {displayMode === 'ALL_ZONES' ? (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      <span>Auto-Slide 15s</span>
                    </>
                  ) : (
                    <>
                      <LayoutGrid className="h-4 w-4" />
                      <span>Xem Đủ 3 Vùng</span>
                    </>
                  )}
                </button>

                {displayMode === 'CAROUSEL' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSlidePinned((p) => !p)}
                      className={`inline-flex min-h-[42px] items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-extrabold ${
                        slidePinned
                          ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                          : 'border-industrial-border bg-slate-900 text-slate-300'
                      }`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                      <span>{slidePinned ? 'Đã ghim' : 'Ghim Slide'}</span>
                    </button>
                    {([0, 1, 2] as const).map((idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSlideIdx(idx)}
                        className={`font-mono-num h-[42px] w-[38px] rounded-xl border text-xs font-black ${
                          slideIdx === idx
                            ? 'border-sky-400 bg-sky-500 text-slate-950'
                            : 'border-industrial-border bg-slate-900 text-slate-300'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => void fetchAndon(false)}
                  className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-industrial-border bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-white"
                  title="Làm mới ngay"
                  aria-label="Làm mới bảng Andon"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-industrial-border bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-sky-400 hover:text-white"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="h-4 w-4 text-sky-400" />
                      <span>Thu nhỏ</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 text-sky-400" />
                      <span>Toàn màn hình</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 3-ZONE LIVE GRID ==================== */}
        <div
          className={
            displayMode === 'ALL_ZONES'
              ? 'grid grid-cols-1 gap-3.5 xl:grid-cols-12'
              : 'grid grid-cols-1 gap-3.5'
          }
        >
          {/* ZONE 1: 23+ MACHINE LIVE STATUS MATRIX */}
          {showZone1 && (
            <section
              aria-label="Lưới trạng thái máy gia công"
              className={`rounded-2xl border border-industrial-border bg-industrial-surface/95 p-3.5 shadow-xl ${
                displayMode === 'ALL_ZONES' ? 'xl:col-span-7' : ''
              }`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 sm:text-base">
                    Vùng 1 · Trạng Thái {machines.length} Máy Gia Công Cơ Khí
                  </h2>
                </div>

                {/* Color Legend */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                    🟢 Chạy: {data?.summary.runningCount ?? 0}
                  </span>
                  <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-amber-300">
                    🟡 Setup: {data?.summary.setupCount ?? 0}
                  </span>
                  <span className="rounded border border-red-500/45 bg-red-500/20 px-2 py-0.5 text-red-300">
                    🔴 Sự cố: {data?.summary.stoppedCount ?? 0}
                  </span>
                  <span className="rounded border border-purple-500/45 bg-purple-500/15 px-2 py-0.5 text-purple-300">
                    🟣 Chờ phôi / Đêm
                  </span>
                  <span className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-300">
                    ⚪ Nghỉ: {data?.summary.idleCount ?? 0}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {machines.map((m) => {
                  const vis = resolveMachineVisualState(m);
                  return (
                    <div
                      key={m.id}
                      data-testid={`andon-machine-${m.id}`}
                      className={`flex flex-col justify-between rounded-xl border p-2.5 transition-all ${vis.cardCls}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-50">
                              {m.name}
                            </div>
                            <div className="truncate text-[11px] text-slate-400">{m.group}</div>
                          </div>
                          {m.isBottleneck && (
                            <span
                              title="Máy cổ chai quá tải"
                              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-red-500/25 px-1.5 py-0.5 font-mono-num text-[10px] font-black text-red-200"
                            >
                              <Flame className="h-3 w-3 text-red-400" />
                              {m.loadPct}%
                            </span>
                          )}
                        </div>

                        <div className="mt-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${vis.pillCls}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${vis.dotCls}`} />
                            {vis.badgeLabel}
                          </span>
                        </div>

                        {m.currentPoId ? (
                          <div className="mt-2 space-y-0.5 text-xs">
                            <div className="truncate font-mono-num font-bold text-sky-300">
                              {m.currentPoId} {m.currentNcId ? `· ${m.currentNcId}` : ''}
                            </div>
                            {m.currentProductName && (
                              <div className="truncate text-[11px] text-slate-200">
                                {m.currentProductName}
                              </div>
                            )}
                            {m.currentWorkerName && (
                              <div className="truncate text-[11px] font-semibold text-emerald-300">
                                👷 {m.currentWorkerName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] italic text-slate-500">
                            Sẵn sàng nhận lệnh điều độ
                          </div>
                        )}

                        {m.stopReason && m.status !== 'RUNNING' && (
                          <div className="mt-1.5 truncate rounded bg-black/40 px-2 py-1 text-[11px] font-bold text-amber-200">
                            ⚠️ {m.stopReason}
                          </div>
                        )}
                      </div>

                      {/* Load Bar */}
                      <div className="mt-2.5">
                        <div className="flex justify-between font-mono-num text-[10px] text-slate-400">
                          <span>Tải KH</span>
                          <span>{m.loadPct}%</span>
                        </div>
                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full ${
                              m.loadPct > 100
                                ? 'bg-red-500'
                                : m.loadPct >= 85
                                  ? 'bg-amber-400'
                                  : 'bg-sky-400'
                            }`}
                            style={{ width: `${Math.min(100, m.loadPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* RIGHT COLUMN IN ALL_ZONES (OR DEDICATED SLIDE IN CAROUSEL) */}
          {(showZone2 || showZone3) && (
            <div
              className={`flex flex-col gap-3.5 ${
                displayMode === 'ALL_ZONES' ? 'xl:col-span-5' : ''
              }`}
            >
              {/* ZONE 2: URGENT & OVERDUE PURCHASE ORDERS */}
              {showZone2 && (
                <section
                  aria-label="Cảnh báo đơn hàng PO gấp"
                  className="rounded-2xl border border-industrial-border bg-industrial-surface/95 p-3.5 shadow-xl"
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-amber-400" />
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 sm:text-base">
                        Vùng 2 · Đơn Hàng PO Khẩn &amp; Sắp Đến Hạn
                      </h2>
                    </div>
                    <Badge variant="warning">{urgentOrders.length} PO ưu tiên</Badge>
                  </div>

                  <div className="space-y-2">
                    {urgentOrders.slice(0, displayMode === 'ALL_ZONES' ? 6 : 12).map((po) => (
                      <div
                        key={po.poId}
                        className={`rounded-xl border p-2.5 ${
                          po.isOverdue
                            ? 'border-red-500/60 bg-red-950/30'
                            : 'border-industrial-border bg-slate-950/80'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono-num text-xs font-black text-sky-300">
                              {po.poId}
                            </span>
                            <span className="text-xs font-bold text-slate-300">
                              · {po.customer}
                            </span>
                            {po.isOverdue && (
                              <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                                QUÁ HẠN
                              </span>
                            )}
                          </div>
                          <span className="font-mono-num text-xs font-semibold text-slate-400">
                            Giao: {formatDateVn(po.dueDate)}
                          </span>
                        </div>

                        <div className="mt-1 truncate text-xs font-bold text-slate-100 sm:text-sm">
                          {po.productName}
                        </div>

                        <div className="mt-1.5 flex items-center gap-2.5">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full rounded-full ${
                                po.progressPct >= 80
                                  ? 'bg-emerald-400'
                                  : po.isOverdue
                                    ? 'bg-red-400'
                                    : 'bg-sky-400'
                              }`}
                              style={{ width: `${po.progressPct}%` }}
                            />
                          </div>
                          <span className="font-mono-num shrink-0 text-xs font-extrabold text-slate-200">
                            {po.finishedQty}/{po.qtyPo} SP ({po.progressPct}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ZONE 3: TOP WORKER STANDARD-HOUR LEADERBOARD (STRICT ZERO SALARY LEAK!) */}
              {showZone3 && (
                <section
                  aria-label="Bảng vàng thi đua thợ xuất sắc"
                  className="rounded-2xl border border-amber-500/35 bg-gradient-to-b from-slate-900 to-industrial-surface p-3.5 shadow-xl"
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-400" />
                      <h2 className="text-sm font-black uppercase tracking-wider text-amber-200 sm:text-base">
                        Vùng 3 · 🏆 Bảng Vàng Giờ Chuẩn Định Mức
                      </h2>
                    </div>
                    <Badge variant="info">Chỉ hiện Giờ ĐM &amp; % KPI</Badge>
                  </div>

                  <div className="space-y-2">
                    {leaderboard.slice(0, displayMode === 'ALL_ZONES' ? 6 : 10).map((w) => {
                      const medal =
                        w.rank === 1
                          ? '🥇'
                          : w.rank === 2
                            ? '🥈'
                            : w.rank === 3
                              ? '🥉'
                              : `#${w.rank}`;
                      const rowCls =
                        w.rank === 1
                          ? 'border-amber-400/70 bg-amber-950/35'
                          : w.rank === 2
                            ? 'border-slate-300/50 bg-slate-800/60'
                            : w.rank === 3
                              ? 'border-orange-400/50 bg-orange-950/30'
                              : 'border-industrial-border bg-slate-950/75';

                      return (
                        <div
                          key={w.workerId}
                          data-testid={`leaderboard-row-${w.workerId}`}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${rowCls}`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="font-mono-num w-7 shrink-0 text-center text-base font-black text-amber-300">
                              {medal}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-slate-50">
                                {w.workerName}
                              </div>
                              <div className="font-mono-num text-[11px] text-slate-400">
                                {w.workerId} · Sản lượng: {formatNumber(w.okQtyTotal)} SP
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2 text-right">
                            <div>
                              <div className="font-mono-num tabular-nums text-sm font-black text-emerald-400 sm:text-base">
                                {formatNumber(w.earnedStdHours, 1)} giờ ĐM
                              </div>
                              <div className="font-mono-num text-[11px] font-bold text-sky-300">
                                Hiệu suất {w.kpiPct}% ĐM
                              </div>
                            </div>
                            <Award className="h-5 w-5 text-amber-400/80" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================== BOTTOM LIVE ALERT TICKER ==================== */}
      <footer className="sticky bottom-0 z-20 border-t border-amber-500/40 bg-slate-950/95 px-4 py-2.5">
        <div className="mx-auto flex max-w-[1920px] items-center gap-3 overflow-hidden">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white">
            <AlertOctagon className="h-4 w-4" />
            ANDON LIVE
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-1 text-xs font-bold text-amber-200 sm:text-sm">
            {tickerItems.map((msg, idx) => (
              <span key={idx} className="truncate">
                {msg}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AndonTvBoard;
