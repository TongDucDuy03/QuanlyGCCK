import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CloudOff,
  Coins,
  Cpu,
  History,
  KeyRound,
  Layers,
  MessageCircle,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Trash2,
  Wifi,
  Wrench,
} from 'lucide-react';
import type {
  BootstrapPayload,
  OperationMeta,
  PayrollCalcResult,
  PurchaseOrderInfo,
  ReportSubmitPayload,
  SystemPayrollConfig,
} from '@shared/types';
import {
  calculateTurnPayroll,
  DEFAULT_PAYROLL_CONFIG,
  getVietnamDateString,
  isObjectiveStopReason,
  isVietnamSunday,
} from '@shared/payrollEngine';
import { matchesSearch } from '@shared/vnSearch';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import { compressImageToDataUrl } from '../../lib/imageCompressor';
import {
  formatDateVn,
  formatDurationSec,
  formatNumber,
  formatVnd,
} from '../../lib/formatters';
import { navigateTo } from '../../lib/navigation';
import {
  flushOfflineOutbox,
  generateIdempotentRecordUid,
  getOfflineOutbox,
  QueuedOfflineReport,
  submitReportWithOfflineFallback,
  subscribeOfflineOutbox,
} from '../../lib/offlineOutbox';
import { Badge, Button, Card, useToast } from '../../components/ui/IndustrialPrimitives';
import { QrScannerModal, SampleQrPreset } from './QrScannerModal';
import { PickerOptionItem, SearchablePickerSheet } from './SearchablePickerSheet';
import { TelegramLinkModal } from './TelegramLinkModal';
import { FaiInspectionModal } from './FaiInspectionModal';
import {
  applyManualToolEdges,
  computeStopTimerElapsed,
  estimateScrapDamageValue,
  getShiftPresetTimes,
  loadStopTimerFromStorage,
  parseTravelerQrPayload,
  pausePersistentStopTimer,
  resetPersistentStopTimer,
  resolveQrToShopfloorSelection,
  RUN_TIMER_STORAGE_KEY,
  saveStopTimerToStorage,
  startPersistentStopTimer,
  STOP_TIMER_STORAGE_KEY,
  StopTimerState,
  syncAutoToolEdges,
  ToolEdgesState,
} from './shopfloorHelpers';

type WorkerTab = 'REPORT' | 'ORDERS_FAI' | 'SALARY_HISTORY';
type PickerKind = 'PO' | 'PRODUCT' | 'OPERATION' | 'MACHINE' | 'TOOL' | 'WORKER_SWITCH' | null;

const SHIFT_OPTIONS = [
  { value: 'Ca 1 (Sáng 06h-14h)', shortLabel: 'Ca 1 (06h-14h)', badge: '1.0x' },
  { value: 'Ca 2 (Chiều 14h-22h)', shortLabel: 'Ca 2 (14h-22h)', badge: '+Ăn ca' },
  { value: 'Ca 3 (Đêm 22h-06h)', shortLabel: 'Ca 3 Đêm (22h-06h)', badge: '1.3x +Ăn' },
  { value: 'Ca Hành chính (07h30-16h30)', shortLabel: 'Hành chính', badge: '07:30-16:30' },
];

const STOP_REASONS = [
  {
    value: 'Không có dừng máy',
    label: '⏸️ Không có dừng máy',
    sub: 'Máy chạy bình thường',
    paid: false,
  },
  {
    value: 'Chờ phôi / Chờ cẩu',
    label: '🏗️ Chờ phôi / Chờ cẩu nâng hạ',
    sub: 'Khách quan — Hưởng 100% lương CB',
    paid: true,
  },
  {
    value: 'Máy hỏng / Sự cố điện',
    label: '🔧 Máy hỏng / Sự cố điện - khí nén',
    sub: 'Khách quan — Hưởng 100% lương CB',
    paid: true,
  },
  {
    value: 'Chờ duyệt mẫu đầu FAI / QC',
    label: '📐 Chờ KCS duyệt con đầu (FAI) / bản vẽ',
    sub: 'Khách quan — Hưởng 100% lương CB',
    paid: true,
  },
  {
    value: 'Thay dao / Setup gá đặt',
    label: '🛠️ Thay dao / Setup gá đặt chi tiết',
    sub: 'Đã tính trong ĐM — Không cộng trùng lương chờ',
    paid: false,
  },
];

function getNowVietnamHhMm(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '06';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}

export function WorkerPortal() {
  const { user, authMode, quickSwitch, quickSwitchProfiles, openPinModal, refreshSession } =
    useAuth();
  const toast = useToast();

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<WorkerTab>('REPORT');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [faiTargetPo, setFaiTargetPo] = useState<PurchaseOrderInfo | null>(null);
  const [activePicker, setActivePicker] = useState<PickerKind>(null);

  // Bootstrap & Network State
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [outboxItems, setOutboxItems] = useState<QueuedOfflineReport[]>(() => getOfflineOutbox());
  const [syncingOutbox, setSyncingOutbox] = useState(false);

  // Form Core Selections
  const [selectedPoId, setSelectedPoId] = useState<string>('PO485-01');
  const [selectedSpId, setSelectedSpId] = useState<string>('SP058');
  const [selectedNcId, setSelectedNcId] = useState<string>('NC098');
  const [machineName, setMachineName] = useState<string>('Máy Tiện CNC 1');
  const [machineMode, setMachineMode] = useState<'FIRST' | 'SECOND'>('FIRST');

  // Quantities & Quality
  const [okQty, setOkQty] = useState<number>(1);
  const [reworkQty, setReworkQty] = useState<number>(0);
  const [scrapQty, setScrapQty] = useState<number>(0);
  const [defectType, setDefectType] = useState<string>('Lỗi Phôi Đúc / Nguyên liệu');
  const [damageValue, setDamageValue] = useState<number>(0);
  const [isDamageDirty, setIsDamageDirty] = useState<boolean>(false);
  const [selfCheckOk, setSelfCheckOk] = useState<boolean>(true);

  // Progressive Disclosure Sections
  const [openStopSection, setOpenStopSection] = useState<boolean>(false);
  const [openShiftSection, setOpenShiftSection] = useState<boolean>(false);
  const [openToolSection, setOpenToolSection] = useState<boolean>(false);
  const [openPhotoSection, setOpenPhotoSection] = useState<boolean>(false);

  // Shift, Date, OT & Lights-Out
  const [workDate, setWorkDate] = useState<string>(() => getVietnamDateString());
  const [shiftType, setShiftType] = useState<string>('Ca 1 (Sáng 06h-14h)');
  const [startTime, setStartTime] = useState<string>('06:00');
  const [endTime, setEndTime] = useState<string>('14:00');
  const [overtimeMinutes, setOvertimeMinutes] = useState<number>(0);
  const [isLightsOut, setIsLightsOut] = useState<boolean>(false);

  // Persistent Stop Timer & Live Run Timer
  const [stopMinutes, setStopMinutes] = useState<number>(0);
  const [stopReason, setStopReason] = useState<string>('Không có dừng máy');
  const [stopTimer, setStopTimer] = useState<StopTimerState>(() =>
    loadStopTimerFromStorage(STOP_TIMER_STORAGE_KEY)
  );
  const [runTimer, setRunTimer] = useState<StopTimerState>(() =>
    loadStopTimerFromStorage(RUN_TIMER_STORAGE_KEY)
  );
  const [clockTick, setClockTick] = useState<number>(() => Date.now());

  // Cutting Tool & 1-for-1 Swap
  const [toolCode, setToolCode] = useState<string>('T03');
  const [toolEdgesState, setToolEdgesState] = useState<ToolEdgesState>({
    edgesUsed: 0.22,
    isEdgesDirty: false,
  });
  const [oldInsertReturned, setOldInsertReturned] = useState<boolean>(true);
  const [swapReason, setSwapReason] = useState<string>('Mòn hết cạnh cắt chuẩn');
  const [swappingTool, setSwappingTool] = useState<boolean>(false);

  // Photo, Lot & Handover Note
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [compressingPhoto, setCompressingPhoto] = useState<boolean>(false);
  const [materialLot, setMaterialLot] = useState<string>('');
  const [handoverNote, setHandoverNote] = useState<string>('');

  // Server Live Preview, Submit Idempotency & Tab 2 Filter
  const [serverPreview, setServerPreview] = useState<{
    payroll: PayrollCalcResult;
    warnings: string[];
  } | null>(null);
  const [todayOverrideIncome, setTodayOverrideIncome] = useState<number | null>(null);
  const [pendingRecordUid, setPendingRecordUid] = useState<string>(() =>
    generateIdempotentRecordUid('NC098')
  );
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [ordersFilter, setOrdersFilter] = useState<'ALL' | 'PENDING_FAI' | 'SCHEDULE'>('ALL');
  const [ordersSearch, setOrdersSearch] = useState<string>('');
  const initializedSelectionRef = useRef<boolean>(false);

  // Subscribe online/offline & outbox
  useEffect(() => {
    const unsub = subscribeOfflineOutbox((items) => setOutboxItems(items));
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Tick 1s when either stopTimer or runTimer is running
  useEffect(() => {
    if (!stopTimer.isRunning && !runTimer.isRunning) return;
    const id = window.setInterval(() => setClockTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [stopTimer.isRunning, runTimer.isRunning]);

  // Persist timers whenever changed
  useEffect(() => {
    saveStopTimerToStorage(stopTimer, STOP_TIMER_STORAGE_KEY);
  }, [stopTimer]);

  useEffect(() => {
    saveStopTimerToStorage(runTimer, RUN_TIMER_STORAGE_KEY);
  }, [runTimer]);

  const loadBootstrapData = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingBootstrap(true);
      try {
        const data = await apiClient.get<BootstrapPayload>('/bootstrap');
        setBootstrap(data);
        setTodayOverrideIncome(null);

        if (!initializedSelectionRef.current && data.operations.length > 0) {
          initializedSelectionRef.current = true;
          if (data.vietnamToday) setWorkDate(data.vietnamToday);

          // Check URL ?qr=... first
          const urlQr =
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('qr')
              : null;
          if (urlQr) {
            const parsed = parseTravelerQrPayload(urlQr);
            const resolved = resolveQrToShopfloorSelection(
              parsed,
              data.ordersList,
              data.operations
            );
            if (resolved) {
              setSelectedPoId(resolved.poId);
              if (resolved.spId) setSelectedSpId(resolved.spId);
              setSelectedNcId(resolved.ncId);
              if (resolved.defaultMachine) setMachineName(resolved.defaultMachine);
              if (resolved.toolCode) setToolCode(resolved.toolCode);
              const matchedOp = data.operations.find((o) => o.ncId === resolved.ncId);
              if (matchedOp) {
                setToolEdgesState(
                  syncAutoToolEdges(
                    { edgesUsed: 0, isEdgesDirty: false },
                    1,
                    matchedOp.stdEdgesPerPcs,
                    true
                  )
                );
              }
              return;
            }
          }

          // Default initial selection: PO485-01 + NC098 if available, else first open PO
          const defaultPo =
            data.ordersList.find((p) => p.poId === 'PO485-01') ||
            data.ordersList.find((p) => p.spId && p.remainQty > 0) ||
            data.ordersList[0];

          if (defaultPo) {
            setSelectedPoId(defaultPo.poId);
            setMaterialLot(defaultPo.materialLot || '');
            const defaultOp =
              (defaultPo.spId
                ? data.operations.find((o) => o.spId === defaultPo.spId)
                : undefined) || data.operations[0];
            if (defaultOp) {
              setSelectedSpId(defaultOp.spId);
              setSelectedNcId(defaultOp.ncId);
              setMachineName(defaultOp.defaultMachine || data.machines[0]?.name || 'Máy Tiện CNC 1');
              setToolCode(defaultOp.toolCode || '');
              setToolEdgesState(
                syncAutoToolEdges(
                  { edgesUsed: 0, isEdgesDirty: false },
                  1,
                  defaultOp.stdEdgesPerPcs,
                  true
                )
              );
            }
          }
        }
      } catch (err: any) {
        const errMsg = String(err?.message || '');
        if (errMsg.includes('Strict PIN') || errMsg.includes('401')) {
          openPinModal();
        } else if (!silent) {
          toast.warning(
            errMsg || 'Đang dùng chế độ ngoại tuyến — bạn vẫn có thể nhập phiếu chờ đồng bộ.'
          );
        }
      } finally {
        setLoadingBootstrap(false);
      }
    },
    [toast, openPinModal]
  );

  useEffect(() => {
    void loadBootstrapData(false);
  }, [loadBootstrapData, user?.workerId]);

  const ordersList = bootstrap?.ordersList ?? [];
  const productsList = bootstrap?.products ?? [];
  const operationsList = bootstrap?.operations ?? [];
  const machinesList = bootstrap?.machines ?? [];
  const toolsList = bootstrap?.toolsList ?? [];
  const schedulesList = bootstrap?.schedules ?? [];

  const selectedPo = useMemo(
    () =>
      selectedPoId === 'PO-THEO-KH'
        ? null
        : ordersList.find((p) => p.poId === selectedPoId) ?? null,
    [ordersList, selectedPoId]
  );

  const selectedOp = useMemo(
    () =>
      selectedNcId === 'NC_STOP'
        ? null
        : operationsList.find((o) => o.ncId === selectedNcId) ?? null,
    [operationsList, selectedNcId]
  );

  const selectedProduct = useMemo(() => {
    const sp = selectedOp?.spId || selectedPo?.spId || selectedSpId;
    return productsList.find((p) => p.spId === sp) ?? null;
  }, [productsList, selectedOp?.spId, selectedPo?.spId, selectedSpId]);

  const selectedMachine = useMemo(
    () =>
      machinesList.find((m) => m.name.toLowerCase() === machineName.toLowerCase()) ??
      machinesList[0] ??
      null,
    [machinesList, machineName]
  );

  const selectedTool = useMemo(
    () => toolsList.find((t) => t.code === toolCode) ?? null,
    [toolsList, toolCode]
  );

  // Sync auto tool edges when okQty changes ONLY if !isEdgesDirty
  useEffect(() => {
    const stdEdges = selectedOp?.stdEdgesPerPcs ?? 0;
    setToolEdgesState((prev) => syncAutoToolEdges(prev, okQty, stdEdges, false));
  }, [okQty, selectedOp?.stdEdgesPerPcs]);

  // Auto-suggest scrap damage value when scrapQty > 0 and !isDamageDirty
  useEffect(() => {
    if (scrapQty <= 0) {
      if (!isDamageDirty) setDamageValue(0);
      return;
    }
    if (!isDamageDirty) {
      setDamageValue(estimateScrapDamageValue(scrapQty, selectedOp));
    }
  }, [scrapQty, selectedOp, isDamageDirty]);

  // Apply operation change helper (resets isEdgesDirty cleanly)
  const applyOperationSelection = useCallback(
    (op: OperationMeta, nextPoId?: string) => {
      setSelectedNcId(op.ncId);
      setSelectedSpId(op.spId);
      if (nextPoId !== undefined) {
        setSelectedPoId(nextPoId);
        const poObj = ordersList.find((p) => p.poId === nextPoId);
        if (poObj?.materialLot) setMaterialLot(poObj.materialLot);
      } else if (selectedPo && selectedPo.spId && selectedPo.spId !== op.spId) {
        const matchingPo = ordersList.find((p) => p.spId === op.spId && p.remainQty > 0);
        setSelectedPoId(matchingPo ? matchingPo.poId : 'PO-THEO-KH');
        if (matchingPo?.materialLot) setMaterialLot(matchingPo.materialLot);
      }
      if (op.defaultMachine) setMachineName(op.defaultMachine);
      if (op.toolCode) setToolCode(op.toolCode);
      setToolEdgesState(
        syncAutoToolEdges({ edgesUsed: 0, isEdgesDirty: false }, okQty, op.stdEdgesPerPcs, true)
      );
      setIsDamageDirty(false);
      setPendingRecordUid(generateIdempotentRecordUid(op.ncId));
    },
    [ordersList, selectedPo, okQty]
  );

  const handleSelectPo = useCallback(
    (poId: string) => {
      setSelectedPoId(poId);
      if (poId === 'PO-THEO-KH') return;
      const po = ordersList.find((p) => p.poId === poId);
      if (!po) return;
      if (po.materialLot) setMaterialLot(po.materialLot);
      const poOps = po.spId
        ? operationsList
            .filter((o) => o.spId === po.spId)
            .sort((a, b) => a.stepOrder - b.stepOrder)
        : operationsList.filter((o) => o.productName === po.productName);
      if (poOps[0]) {
        applyOperationSelection(poOps[0], po.poId);
      }
    },
    [ordersList, operationsList, applyOperationSelection]
  );

  const handleQrDetected = useCallback(
    (rawQr: string) => {
      const parsed = parseTravelerQrPayload(rawQr);
      if (!parsed.valid) {
        toast.error(`Mã QR không đúng chuẩn GCCK: "${rawQr}"`);
        return;
      }
      const resolved = resolveQrToShopfloorSelection(parsed, ordersList, operationsList);
      if (!resolved) {
        toast.warning(
          `Đã đọc mã ${parsed.poId}${parsed.ncId ? ` / ${parsed.ncId}` : ''} nhưng không tìm thấy trong danh mục hiện tại.`
        );
        return;
      }

      const op = operationsList.find((o) => o.ncId === resolved.ncId);
      if (op) {
        applyOperationSelection(op, resolved.poId);
      } else {
        setSelectedPoId(resolved.poId);
        setSelectedNcId(resolved.ncId);
      }
      setActiveTab('REPORT');

      if (resolved.reconciledWarning) {
        toast.info(resolved.reconciledWarning);
      } else {
        toast.success(
          `⚡ Đã nạp QR: ${resolved.poId} · ${resolved.ncId} (${resolved.productName})`
        );
      }
    },
    [ordersList, operationsList, applyOperationSelection, toast]
  );

  // Instant Local Payroll Calculation (0ms latency)
  const payrollConfig: SystemPayrollConfig = useMemo(() => {
    const cfg = bootstrap?.config;
    if (!cfg) return DEFAULT_PAYROLL_CONFIG;
    return {
      secondsPerShift: Number(cfg.SECONDS_PER_SHIFT || 28800),
      secondMachineRate: Number(cfg.SECOND_MACHINE_RATE || 0.33),
      mealShift23: Number(cfg.MEAL_SHIFT_2_3 || 20000),
      mealOt2h: Number(cfg.MEAL_OT_2H || 15000),
      mealSunday: Number(cfg.MEAL_SUNDAY || 30000),
      kpiWarningThreshold: Number(cfg.KPI_WARNING_THRESHOLD || 0.85),
    };
  }, [bootstrap?.config]);

  const isSundaySelected = useMemo(() => isVietnamSunday(workDate), [workDate]);

  const localPayroll = useMemo(() => {
    return calculateTurnPayroll(
      {
        workerId: user?.workerId || 'NV00214',
        salaryMode: user?.salaryMode || 'Khoán 1 + 0.33 máy',
        costPerSec: Number(user?.costPerSec ?? 13.37),
        workDate,
        shiftType,
        startTime,
        endTime,
        overtimeMinutes,
        isSunday: isSundaySelected,
        isLightsOut,
        machineName,
        machineMode,
        machineCostPerHour: Number(selectedMachine?.costPerHour || 250000),
        stdSeconds: Number(selectedOp?.stdSeconds || 0),
        stdEdgesPerPcs: Number(selectedOp?.stdEdgesPerPcs || 0),
        costPerEdge: Number(selectedTool?.costPerEdge ?? selectedOp?.costPerEdge ?? 0),
        edgesUsed: toolEdgesState.isEdgesDirty ? toolEdgesState.edgesUsed : undefined,
        okQty,
        reworkQty,
        scrapQty,
        defectType: scrapQty > 0 ? defectType : '',
        damageValue: scrapQty > 0 ? damageValue : 0,
        stopMinutes,
        stopReason: stopMinutes > 0 ? stopReason : 'Không có dừng máy',
      },
      {},
      payrollConfig
    );
  }, [
    user?.workerId,
    user?.salaryMode,
    user?.costPerSec,
    workDate,
    shiftType,
    startTime,
    endTime,
    overtimeMinutes,
    isSundaySelected,
    isLightsOut,
    machineName,
    machineMode,
    selectedMachine?.costPerHour,
    selectedOp?.stdSeconds,
    selectedOp?.stdEdgesPerPcs,
    selectedOp?.costPerEdge,
    selectedTool?.costPerEdge,
    toolEdgesState,
    okQty,
    reworkQty,
    scrapQty,
    defectType,
    damageValue,
    stopMinutes,
    stopReason,
    payrollConfig,
  ]);

  // Debounced Server Authoritative Preview (syncs prior shift meal/OT/overlap + QC warnings)
  useEffect(() => {
    if (!user || !isOnline) {
      setServerPreview(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiClient.post<{ payroll: PayrollCalcResult; warnings: string[] }>(
          '/reports/preview',
          {
            workDate,
            shiftType,
            startTime,
            endTime,
            overtimeMinutes,
            isSunday: isSundaySelected,
            isLightsOut,
            machineName,
            machineMode,
            poId: selectedPoId,
            ncId: selectedNcId || 'NC_STOP',
            toolCode,
            edgesUsed: toolEdgesState.edgesUsed,
            isEdgesDirty: toolEdgesState.isEdgesDirty,
            okQty,
            reworkQty,
            scrapQty,
            defectType: scrapQty > 0 ? defectType : '',
            damageValue: scrapQty > 0 ? damageValue : 0,
            stopMinutes,
            stopReason: stopMinutes > 0 ? stopReason : 'Không có dừng máy',
            selfCheckOk,
          },
          { timeoutMs: 6000 }
        );
        setServerPreview(res);
      } catch {
        setServerPreview(null);
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [
    user,
    isOnline,
    workDate,
    shiftType,
    startTime,
    endTime,
    overtimeMinutes,
    isSundaySelected,
    isLightsOut,
    machineName,
    machineMode,
    selectedPoId,
    selectedNcId,
    toolCode,
    toolEdgesState,
    okQty,
    reworkQty,
    scrapQty,
    defectType,
    damageValue,
    stopMinutes,
    stopReason,
    selfCheckOk,
  ]);

  const effectivePayroll = serverPreview?.payroll ?? localPayroll;
  const myTodayIncome = useMemo(() => {
    if (todayOverrideIncome !== null) return todayOverrideIncome;
    if (!user || !bootstrap?.todayAccumulated) return 0;
    return Number(bootstrap.todayAccumulated[user.workerId] || 0);
  }, [todayOverrideIncome, user, bootstrap?.todayAccumulated]);

  // Shift Handover Alert matching selected machine or PO
  const matchingHandoverAlerts = useMemo(() => {
    const list = bootstrap?.shiftHandoverAlerts ?? [];
    return list.filter(
      (h) =>
        h.machineName.toLowerCase() === machineName.toLowerCase() ||
        (selectedPoId !== 'PO-THEO-KH' && h.poId === selectedPoId)
    );
  }, [bootstrap?.shiftHandoverAlerts, machineName, selectedPoId]);

  // Soft quality & over-PO warnings
  const opDoneSoFar = selectedOp ? Number(bootstrap?.opDoneMap?.[selectedOp.ncId] || 0) : 0;
  const combinedWarnings = useMemo(() => {
    const list = [...(serverPreview?.warnings ?? [])];
    if (selectedPo && okQty > 0 && selectedOp?.isFinalOp === 1) {
      if (selectedPo.finishedQty + okQty > selectedPo.qtyPo) {
        list.push(
          `SL hoàn thành cộng dồn (${selectedPo.finishedQty + okQty} SP) vượt SL đặt của Lệnh ${selectedPo.poId} (${selectedPo.qtyPo} SP).`
        );
      }
    }
    return Array.from(new Set(list));
  }, [serverPreview?.warnings, selectedPo, okQty, selectedOp?.isFinalOp]);

  // Timer Snapshots
  const stopSnap = useMemo(
    () => computeStopTimerElapsed(stopTimer, clockTick),
    [stopTimer, clockTick]
  );
  const runSnap = useMemo(
    () => computeStopTimerElapsed(runTimer, clockTick),
    [runTimer, clockTick]
  );

  // Sample QR Presets enriched with live bootstrap data
  const sampleQrPresets = useMemo<SampleQrPreset[]>(() => {
    const dynamic: SampleQrPreset[] = [];
    const po485 = ordersList.find((p) => p.poId === 'PO485-01');
    const nc098 = operationsList.find((o) => o.ncId === 'NC098');
    const nc274 = operationsList.find((o) => o.ncId === 'NC274');
    if (po485 && nc098) {
      dynamic.push({
        qrPayload: `GCCK|${po485.poId}|${nc098.ncId}`,
        title: `${po485.poId} · ${po485.productName}`,
        subtitle: `${nc098.ncId} — ${nc098.opName} · ${nc098.defaultMachine} (${nc098.stdSeconds}s)`,
        badge: 'Bước 1 WIP',
      });
    }
    if (po485 && nc274) {
      dynamic.push({
        qrPayload: `GCCK|${po485.poId}|${nc274.ncId}`,
        title: `${po485.poId} · ${po485.productName}`,
        subtitle: `${nc274.ncId} — ${nc274.opName} [End] · ${nc274.defaultMachine} (${nc274.stdSeconds}s)`,
        badge: 'Bước Cuối',
      });
    }
    dynamic.push({
      qrPayload: 'GCCK|PO485-01|NC158',
      title: 'GCCK|PO485-01|NC158 · Búa đập VHC-111',
      subtitle: 'NC158 — G/c làm định vị · Máy tiện FUJI (3600s)',
      badge: 'QR Mẫu Test',
    });
    dynamic.push({
      qrPayload: 'GCCK|PO-THEO-KH|NC088',
      title: 'Ống bạc chặn D174x428',
      subtitle: 'NC088 — G/c phay MP NC2 · Máy phay OKK1 (720s)',
      badge: 'Phay CK',
    });
    return dynamic;
  }, [ordersList, operationsList]);

  // Searchable Picker Options
  const pickerConfig = useMemo(() => {
    if (activePicker === 'PO') {
      const opts: PickerOptionItem[] = [
        {
          id: 'PO-THEO-KH',
          primaryText: 'PO-THEO-KH — Gia công lẻ / Theo kế hoạch xưởng',
          secondaryText: 'Dùng cho chi tiết sửa chữa, nội bộ hoặc không gắn PO cố định',
          metaBadge: 'PO-THEO-KH',
          metaVariant: 'purple',
        },
        ...ordersList.map((po) => ({
          id: po.poId,
          primaryText: `${po.productName}`,
          secondaryText: `KH: ${po.customer} · Tiến độ: ${po.finishedQty}/${po.qtyPo} SP · Hạn: ${formatDateVn(po.dueDate)} · Lô: ${po.materialLot || '—'}`,
          metaBadge: po.poId,
          metaVariant: (po.remainQty > 0 && po.dueDate < workDate
            ? 'red'
            : po.remainQty > 0
              ? 'sky'
              : 'emerald') as PickerOptionItem['metaVariant'],
          rightText: po.status,
          searchKeywords: `${po.poId} ${po.customer} ${po.productName} ${po.spId || ''}`,
        })),
      ];
      return {
        title: 'Chọn Lệnh Sản Xuất / Đơn Hàng (PO)',
        subtitle: `Tổng cộng ${ordersList.length} đơn hàng PO trong hệ thống`,
        options: opts,
        selectedId: selectedPoId,
        onSelect: handleSelectPo,
      };
    }

    if (activePicker === 'PRODUCT') {
      const opts: PickerOptionItem[] = productsList.map((prod) => ({
        id: prod.spId,
        primaryText: prod.productName,
        secondaryText: `Khách hàng: ${prod.customer} · Vật liệu: ${prod.matName || 'Thép CK'} · ${prod.opCount || 1} nguyên công`,
        metaBadge: prod.spId,
        metaVariant: 'sky',
        rightText: prod.opsSummary || '',
        searchKeywords: `${prod.spId} ${prod.customer} ${prod.productName} ${prod.matName || ''}`,
      }));
      return {
        title: 'Chọn Sản Phẩm / Bản Vẽ Chi Tiết',
        subtitle: `Hiển thị đầy đủ ${productsList.length} bản vẽ chi tiết (không cắt chữ)`,
        options: opts,
        selectedId: selectedProduct?.spId || selectedSpId,
        onSelect: (spId: string) => {
          setSelectedSpId(spId);
          const firstOp = operationsList
            .filter((o) => o.spId === spId)
            .sort((a, b) => a.stepOrder - b.stepOrder)[0];
          const matchingPo = ordersList.find((p) => p.spId === spId && p.remainQty > 0);
          if (firstOp) {
            applyOperationSelection(firstOp, matchingPo ? matchingPo.poId : 'PO-THEO-KH');
          }
        },
      };
    }

    if (activePicker === 'OPERATION') {
      // Show current product ops at top, followed by all other ops so worker can also global-search!
      const curSp = selectedOp?.spId || selectedPo?.spId || selectedSpId;
      const sortedOps = [...operationsList].sort((a, b) => {
        const aMatch = a.spId === curSp ? 0 : 1;
        const bMatch = b.spId === curSp ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return a.stepOrder - b.stepOrder;
      });
      const opts: PickerOptionItem[] = [
        {
          id: 'NC_STOP',
          primaryText: '🛑 Báo cáo Dừng Máy / Chờ Phôi Thuần Túy (Không ra SP)',
          secondaryText: 'Ghi nhận thời gian dừng máy khách quan hưởng 100% lương cơ bản',
          metaBadge: 'NC_STOP',
          metaVariant: 'amber',
        },
        ...sortedOps.map((op) => ({
          id: op.ncId,
          primaryText: `${op.opName} — ${op.productName}`,
          secondaryText: `KH: ${op.customer} · Máy: ${op.defaultMachine} · Dao: ${op.toolCode || '—'} · Vật liệu: ${op.matName || '—'}`,
          metaBadge: `${op.ncId} · Bước ${op.stepOrder}${op.isFinalOp === 1 ? ' [END]' : ' [WIP]'}`,
          metaVariant: (op.spId === curSp
            ? op.isFinalOp === 1
              ? 'emerald'
              : 'sky'
            : 'slate') as PickerOptionItem['metaVariant'],
          rightText: `${op.stdSeconds}s${op.isCriticalCheck === 1 ? ' ★' : ''}`,
          searchKeywords: `${op.ncId} ${op.spId} ${op.customer} ${op.productName} ${op.opName} ${op.defaultMachine}`,
        })),
      ];
      return {
        title: 'Tìm & Chọn Nguyên Công Gia Công (627 NC)',
        subtitle: 'Ưu tiên nguyên công thuộc bản vẽ đang chọn lên đầu danh sách',
        options: opts,
        selectedId: selectedNcId,
        onSelect: (ncId: string) => {
          if (ncId === 'NC_STOP') {
            setSelectedNcId('NC_STOP');
            setOkQty(0);
            setOpenStopSection(true);
            if (stopMinutes === 0) setStopMinutes(30);
            if (!isObjectiveStopReason(stopReason)) setStopReason('Chờ phôi / Chờ cẩu');
            setPendingRecordUid(generateIdempotentRecordUid('NC_STOP'));
            return;
          }
          const op = operationsList.find((o) => o.ncId === ncId);
          if (op) applyOperationSelection(op);
        },
      };
    }

    if (activePicker === 'MACHINE') {
      const opts: PickerOptionItem[] = machinesList.map((m) => ({
        id: m.name,
        primaryText: m.name,
        secondaryText: `Nhóm: ${m.group}${m.currentWorkerName ? ` · Đang đứng: ${m.currentWorkerName}` : ''}${m.currentPoId ? ` (${m.currentPoId})` : ''}`,
        metaBadge: m.id,
        metaVariant:
          m.status === 'RUNNING'
            ? 'emerald'
            : m.status === 'STOPPED'
              ? 'red'
              : m.status === 'SETUP'
                ? 'amber'
                : 'slate',
        rightText: m.status || 'IDLE',
        searchKeywords: `${m.id} ${m.name} ${m.group}`,
      }));
      return {
        title: 'Chọn Máy Gia Công Đang Đứng',
        subtitle: `Danh sách ${machinesList.length} máy công cụ tại xưởng`,
        options: opts,
        selectedId: machineName,
        onSelect: (name: string) => setMachineName(name),
      };
    }

    if (activePicker === 'TOOL') {
      const opts: PickerOptionItem[] = toolsList.map((t) => ({
        id: t.code,
        primaryText: `${t.name}`,
        secondaryText: `Nhóm: ${t.group} · Chuẩn ${t.edges} cạnh/mảnh · Tồn kho: ${t.stockQty ?? 0} mảnh`,
        metaBadge: t.code,
        metaVariant: (t.stockQty ?? 0) > 5 ? 'emerald' : 'amber',
        rightText: `Tồn: ${t.stockQty ?? 0}`,
        searchKeywords: `${t.code} ${t.group} ${t.name}`,
      }));
      return {
        title: 'Chọn Mã Dao Cụ / Mảnh Chíp Cắt',
        subtitle: `Danh mục ${toolsList.length} mã dao cụ tiêu chuẩn`,
        options: opts,
        selectedId: toolCode,
        onSelect: (code: string) => setToolCode(code),
      };
    }

    if (activePicker === 'WORKER_SWITCH') {
      const opts: PickerOptionItem[] = quickSwitchProfiles.map((p) => ({
        id: p.workerId,
        primaryText: `${p.name}`,
        secondaryText: `Chức danh: ${p.title} · Chế độ: ${p.salaryMode}`,
        metaBadge: p.workerId,
        metaVariant: p.appRole === 'WORKER' ? 'emerald' : 'sky',
        rightText: p.role,
      }));
      return {
        title: 'Đổi Phiên Nhân Sự Đứng Máy (Demo Nhanh)',
        subtitle: 'Thu nhập cá nhân được bảo mật riêng theo từng tài khoản',
        options: opts,
        selectedId: user?.workerId || '',
        onSelect: (wid: string) => {
          void quickSwitch({ workerId: wid })
            .then((u) => {
              if (u) toast.success(`Đã chuyển sang phiên làm việc của ${u.name}`);
            })
            .catch(() => openPinModal(wid));
        },
      };
    }

    return null;
  }, [
    activePicker,
    ordersList,
    productsList,
    operationsList,
    machinesList,
    toolsList,
    quickSwitchProfiles,
    selectedPoId,
    selectedProduct?.spId,
    selectedSpId,
    selectedOp?.spId,
    selectedPo?.spId,
    selectedNcId,
    machineName,
    toolCode,
    workDate,
    stopMinutes,
    stopReason,
    user?.workerId,
    handleSelectPo,
    applyOperationSelection,
    quickSwitch,
    openPinModal,
    toast,
  ]);

  // Handlers: Photo Upload, 1-for-1 Tool Swap, Outbox Sync, Submit Report
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressingPhoto(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 1280, 0.78);
      setPhotoBase64(dataUrl);
      toast.success('Đã nén ảnh minh chứng nhẹ chuẩn HD sẵn sàng gửi!');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xử lý ảnh chụp.');
    } finally {
      setCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const handleToolSwap = async () => {
    if (!toolCode) {
      toast.warning('Vui lòng chọn mã dao cụ trước khi đổi chíp.');
      return;
    }
    setSwappingTool(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        message: string;
        tool: { code: string; stockQty: number };
      }>('/master/tools/swap', {
        toolCode,
        machineName,
        oldInsertReturned,
        qtyIssued: 1,
        reason: swapReason,
      });
      toast.success(res.message);
      await loadBootstrapData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể ghi nhận đổi chíp 1-đổi-1.');
    } finally {
      setSwappingTool(false);
    }
  };

  const handleManualFlushOutbox = async () => {
    setSyncingOutbox(true);
    try {
      const res = await flushOfflineOutbox();
      if (res.synced > 0) {
        toast.success(`Đã đồng bộ thành công ${res.synced} phiếu chờ lên máy chủ!`);
        await loadBootstrapData(true);
      } else if (res.remaining > 0) {
        toast.warning(`Còn ${res.remaining} phiếu chưa gửi được — kiểm tra kết nối Wi-Fi xưởng.`);
      } else {
        toast.info('Tất cả phiếu đã được đồng bộ.');
      }
    } finally {
      setSyncingOutbox(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!user) {
      openPinModal();
      return;
    }

    // Apply live stop timer minutes if worker left stopwatch running with stopMinutes === 0
    let finalStopMinutes = stopMinutes;
    if (finalStopMinutes === 0 && (stopTimer.isRunning || stopTimer.accumulatedMs > 0)) {
      finalStopMinutes = stopSnap.elapsedMinutes;
      setStopMinutes(finalStopMinutes);
    }

    if (okQty <= 0 && reworkQty <= 0 && scrapQty <= 0 && finalStopMinutes <= 0) {
      toast.warning('Vui lòng nhập sản lượng (OK / Sửa / Hủy) hoặc số phút Dừng máy!');
      return;
    }

    const effectiveNcId =
      selectedNcId === 'NC_STOP' || (!selectedOp && finalStopMinutes > 0)
        ? 'NC_STOP'
        : selectedNcId || 'NC_STOP';

    const payload: ReportSubmitPayload = {
      recordUid: pendingRecordUid,
      workDate,
      shiftType,
      startTime,
      endTime,
      overtimeMinutes,
      isSunday: isSundaySelected,
      isLightsOut,
      workerId: user.workerId,
      machineName,
      machineMode,
      poId: selectedPoId || 'PO-THEO-KH',
      ncId: effectiveNcId,
      toolCode,
      edgesUsed: toolEdgesState.edgesUsed,
      isEdgesDirty: toolEdgesState.isEdgesDirty,
      okQty,
      reworkQty,
      scrapQty,
      defectType: scrapQty > 0 ? defectType : '',
      damageValue: scrapQty > 0 ? damageValue : 0,
      stopMinutes: finalStopMinutes,
      stopReason: finalStopMinutes > 0 ? stopReason : 'Không có dừng máy',
      selfCheckOk,
      materialLot,
      handoverNote,
      photoBase64: photoBase64 || undefined,
    };

    setSubmittingReport(true);
    try {
      const result = await submitReportWithOfflineFallback(payload);
      if (result.queuedOffline) {
        toast.warning(
          `🟠 Mất Wi-Fi: Đã lưu an toàn phiếu (${payload.recordUid}) vào Hàng đợi Offline!`
        );
      } else if (result.response) {
        setTodayOverrideIncome(result.response.todayTotalIncome);
        toast.success(
          `✅ ${result.response.message} | Thu nhập ca: +${formatVnd(result.response.payroll.turnTotalIncome)}`
        );
        if (result.response.warnings?.length) {
          toast.warning(result.response.warnings[0]);
        }
        await loadBootstrapData(true);
      }

      // Reset form turn counters & generate fresh idempotency UID for next submission
      setOkQty(1);
      setReworkQty(0);
      setScrapQty(0);
      setIsDamageDirty(false);
      setDamageValue(0);
      setStopMinutes(0);
      setStopTimer(resetPersistentStopTimer());
      setRunTimer(resetPersistentStopTimer());
      setPhotoBase64('');
      setHandoverNote('');
      setToolEdgesState(
        syncAutoToolEdges(
          { edgesUsed: 0, isEdgesDirty: false },
          1,
          selectedOp?.stdEdgesPerPcs ?? 0,
          true
        )
      );
      setPendingRecordUid(generateIdempotentRecordUid(effectiveNcId));
    } catch (err: any) {
      toast.error(err?.message || 'Gửi báo cáo thất bại.');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Tab 2 Filtered Orders & Pending FAI Count
  const pendingFaiCount = useMemo(
    () =>
      ordersList.filter(
        (po) => po.remainQty > 0 && po.qtyPo >= 5 && po.faiStatus !== 'FAI_PASSED'
      ).length,
    [ordersList]
  );

  const filteredTab2Orders = useMemo(() => {
    return ordersList
      .filter((po) => {
        if (ordersFilter === 'PENDING_FAI') {
          return po.remainQty > 0 && po.qtyPo >= 5 && po.faiStatus !== 'FAI_PASSED';
        }
        return po.remainQty > 0 || po.finishedQty < po.qtyPo;
      })
      .filter((po) => {
        if (!ordersSearch.trim()) return true;
        return matchesSearch(
          `${po.poId} ${po.customer} ${po.productName} ${po.materialLot || ''}`,
          ordersSearch
        );
      });
  }, [ordersList, ordersFilter, ordersSearch]);

  // Tab 3 Personal Logs (strictly scoped to current logged-in worker when role === WORKER)
  const myRecentLogs = useMemo(() => {
    const all = bootstrap?.recentLogs ?? [];
    if (!user) return [];
    return all.filter((l) => l.workerId === user.workerId);
  }, [bootstrap?.recentLogs, user]);

  return (
    <div className="w-full max-w-full overflow-x-clip pb-24">
      {/* ==================== STICKY LIVE SALARY & WORKER STATUS HEADER ==================== */}
      <section
        aria-label="Thu nhập tạm tính và trạng thái kết nối"
        className="sticky top-0 z-30 border-b border-industrial-border bg-slate-950/95 backdrop-blur-md"
      >
        <div className="mx-auto w-full max-w-3xl space-y-2 px-2.5 py-2.5 sm:px-4">
          {/* 2 Glowing Metric Cards: Turn Salary & Today Accumulated */}
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 px-3 py-2 shadow-inner">
              <div className="truncate text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">
                Lương tạm tính lượt này
              </div>
              <div
                data-testid="live-turn-income"
                className="font-mono-num tabular-nums mt-0.5 truncate text-lg font-extrabold text-emerald-400 sm:text-2xl"
              >
                {formatVnd(effectivePayroll.turnTotalIncome)}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-1 text-[11px] text-slate-400">
                <span className="truncate">
                  {effectivePayroll.isMonthlyStaff
                    ? 'Chốt 3P cuối tháng'
                    : effectivePayroll.kpiStatus}
                </span>
                {effectivePayroll.mealAllowance > 0 && (
                  <span className="shrink-0 font-mono-num text-amber-300">
                    +{Math.round(effectivePayroll.mealAllowance / 1000)}k ăn
                  </span>
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-sky-500/40 bg-gradient-to-br from-sky-950/60 via-slate-900 to-slate-950 px-3 py-2 shadow-inner">
              <div className="truncate text-[11px] font-bold uppercase tracking-wider text-sky-300/90">
                Tích lũy hôm nay
              </div>
              <div
                data-testid="today-accumulated-income"
                className="font-mono-num tabular-nums mt-0.5 truncate text-lg font-extrabold text-sky-300 sm:text-2xl"
              >
                {formatVnd(myTodayIncome)}
              </div>
              <div className="mt-0.5 truncate font-mono-num text-[11px] text-slate-400">
                Dự kiến: {formatVnd(myTodayIncome + effectivePayroll.turnTotalIncome)}
              </div>
            </div>
          </div>

          {/* Worker Identity + Action Strip (All touch targets >= 48px) */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => {
                if (authMode === 'DEMO_QUICK' && quickSwitchProfiles.length > 0) {
                  setActivePicker('WORKER_SWITCH');
                } else {
                  openPinModal(user?.workerId);
                }
              }}
              className="flex min-h-[48px] min-w-0 items-center justify-center gap-1.5 rounded-xl border border-industrial-border bg-industrial-elevated px-2.5 py-1.5 text-xs font-bold text-slate-100 hover:border-sky-400"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-sky-400" />
              <span className="truncate">
                {user ? `${user.name.split(' ').slice(-2).join(' ')}` : 'Đăng nhập PIN'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTelegramModalOpen(true)}
              className="flex min-h-[48px] min-w-0 items-center justify-center gap-1.5 rounded-xl border border-industrial-border bg-industrial-elevated px-2.5 py-1.5 text-xs font-bold text-slate-100 hover:border-emerald-400"
            >
              <MessageCircle
                className={`h-4 w-4 shrink-0 ${user?.isLinked ? 'text-emerald-400' : 'text-slate-400'}`}
              />
              <span className="truncate">
                {user?.isLinked ? 'Telegram: Đã nối' : '📲 Telegram 1-1'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (outboxItems.length > 0) {
                  void handleManualFlushOutbox();
                } else {
                  toast.info(
                    isOnline
                      ? 'Kết nối mạng xưởng ổn định — dữ liệu đồng bộ tức thì.'
                      : 'Đang mất Wi-Fi: Mọi báo cáo gửi sẽ tự lưu Offline Outbox.'
                  );
                }
              }}
              className={`flex min-h-[48px] min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold ${
                !isOnline || outboxItems.length > 0
                  ? 'border-amber-500/60 bg-amber-950/50 text-amber-200'
                  : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
              }`}
            >
              {!isOnline || outboxItems.length > 0 ? (
                <>
                  <CloudOff className="h-4 w-4 shrink-0 text-amber-400" />
                  <span className="truncate">
                    Offline ({outboxItems.length} chờ)
                  </span>
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="truncate">🟢 Online</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void loadBootstrapData(false)}
              disabled={loadingBootstrap}
              className="flex min-h-[48px] min-w-0 items-center justify-center gap-1.5 rounded-xl border border-industrial-border bg-industrial-elevated px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-sky-400"
            >
              <RefreshCw
                className={`h-4 w-4 shrink-0 text-sky-400 ${loadingBootstrap ? 'animate-spin' : ''}`}
              />
              <span className="truncate">Làm mới</span>
            </button>
          </div>
        </div>
      </section>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <main className="mx-auto w-full max-w-3xl space-y-3 px-2.5 pt-3 sm:px-4">
        {/* ==================== TAB 1: ⚡ BÁO CÁO SẢN XUẤT ==================== */}
        {activeTab === 'REPORT' && (
          <>
            {/* 1. Hero QR Scan Button + Fast Search */}
            <Card className="space-y-2.5 border-sky-500/30 bg-gradient-to-b from-slate-900 to-industrial-surface p-3 sm:p-4">
              <button
                type="button"
                onClick={() => setQrModalOpen(true)}
                className="flex min-h-[54px] w-full min-w-0 items-center justify-center gap-2.5 rounded-xl border border-sky-300/60 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 px-4 py-3 text-sm font-black tracking-wide text-slate-950 shadow-lg shadow-sky-950/60 transition-transform active:scale-[0.99] sm:text-base"
              >
                <QrCode className="h-6 w-6 shrink-0" />
                <span className="truncate">📷 QUÉT MÃ QR PHIẾU CÔNG NGHỆ</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePicker('OPERATION')}
                className="flex min-h-[48px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-industrial-border bg-slate-950 px-3.5 py-2 text-left text-xs text-slate-300 hover:border-sky-400"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Search className="h-4 w-4 shrink-0 text-sky-400" />
                  <span className="truncate">
                    Tìm nhanh không dấu: mã NC, tên bản vẽ (&quot;, Φ, #), khách hàng...
                  </span>
                </span>
                <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono-num text-[11px] font-bold text-sky-300">
                  {operationsList.length} NC
                </span>
              </button>
            </Card>

            {/* 2. Shift Handover Yellow Alert Banner (Auto-triggers when machine or PO has handoverNote) */}
            {matchingHandoverAlerts.length > 0 && (
              <div
                role="alert"
                className="rounded-xl border-2 border-amber-400/80 bg-amber-950/60 p-3.5 text-amber-100 shadow-lg"
              >
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>⚠️ Lưu Ý Bàn Giao Từ Ca Trước ({matchingHandoverAlerts[0].machineName})</span>
                </div>
                <p className="mt-1 break-words text-sm font-bold text-amber-50">
                  &ldquo;{matchingHandoverAlerts[0].handoverNote}&rdquo;
                </p>
                <div className="mt-1 text-[11px] text-amber-200/80">
                  Thợ bàn giao: <strong>{matchingHandoverAlerts[0].workerName}</strong> ·{' '}
                  {matchingHandoverAlerts[0].shiftType} · Lệnh {matchingHandoverAlerts[0].poId}
                </div>
              </div>
            )}

            {/* 3. Multi-Line Searchable Selection Cards (Zero <select> truncation!) */}
            <Card className="space-y-2.5 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  1. Lệnh Sản Xuất · Bản Vẽ · Nguyên Công &amp; Máy
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNcId('NC_STOP');
                    setOkQty(0);
                    setOpenStopSection(true);
                    if (stopMinutes === 0) setStopMinutes(30);
                    if (!isObjectiveStopReason(stopReason)) setStopReason('Chờ phôi / Chờ cẩu');
                  }}
                  className="min-h-[48px] rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
                >
                  🛑 Chỉ báo dừng máy
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* PO Trigger */}
                <button
                  type="button"
                  onClick={() => setActivePicker('PO')}
                  className="flex min-h-[54px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-industrial-border bg-industrial-elevated p-3 text-left hover:border-sky-400"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase text-slate-400">
                      Đơn hàng / Lệnh SX (PO)
                    </div>
                    <div className="mt-0.5 truncate font-mono-num text-sm font-extrabold text-sky-300">
                      {selectedPo ? `${selectedPo.poId} (${selectedPo.customer})` : 'PO-THEO-KH (Kế hoạch lẻ)'}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                </button>

                {/* Machine Trigger */}
                <button
                  type="button"
                  onClick={() => setActivePicker('MACHINE')}
                  className="flex min-h-[54px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-industrial-border bg-industrial-elevated p-3 text-left hover:border-sky-400"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase text-slate-400">
                      Máy gia công đứng vận hành
                    </div>
                    <div className="mt-0.5 truncate text-sm font-extrabold text-emerald-300">
                      {machineName}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                </button>
              </div>

              {/* Product Full Multi-line Trigger */}
              <button
                type="button"
                onClick={() => setActivePicker('PRODUCT')}
                className="flex min-h-[56px] w-full min-w-0 items-start justify-between gap-2 rounded-xl border border-industrial-border bg-industrial-elevated p-3 text-left hover:border-sky-400"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-400">
                    <span>Chi tiết bản vẽ / Khách hàng</span>
                    {(selectedOp?.customer || selectedProduct?.customer) && (
                      <Badge variant="info">
                        {selectedOp?.customer || selectedProduct?.customer}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 break-words text-sm font-extrabold leading-snug text-slate-50">
                    {selectedOp?.productName ||
                      selectedProduct?.productName ||
                      selectedPo?.productName ||
                      'Chạm để chọn bản vẽ sản phẩm...'}
                  </div>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
              </button>

              {/* Operation Multi-line Trigger */}
              <button
                type="button"
                onClick={() => setActivePicker('OPERATION')}
                className="flex min-h-[56px] w-full min-w-0 items-start justify-between gap-2 rounded-xl border border-sky-500/45 bg-sky-950/25 p-3 text-left hover:border-sky-400"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-sky-300">
                    <span className="font-mono-num font-extrabold">
                      {selectedOp ? selectedOp.ncId : 'NC_STOP'}
                    </span>
                    {selectedOp && (
                      <Badge variant={selectedOp.isFinalOp === 1 ? 'success' : 'info'}>
                        {selectedOp.isFinalOp === 1
                          ? `Bước ${selectedOp.stepOrder} (End - Nhập kho)`
                          : `Bước ${selectedOp.stepOrder} (Bán TP WIP)`}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 break-words text-sm font-extrabold leading-snug text-slate-50">
                    {selectedOp
                      ? `${selectedOp.opName} (ĐM: ${formatDurationSec(selectedOp.stdSeconds)})`
                      : '🛑 Báo cáo Dừng Máy / Chờ Phôi (Hưởng 100% Lương CB)'}
                  </div>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-sky-400" />
              </button>

              {/* Dual Machine Mode Selector (100% vs 0.33) */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setMachineMode('FIRST')}
                  className={`flex min-h-[48px] min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-extrabold transition-colors ${
                    machineMode === 'FIRST'
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-industrial-border bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cpu className="h-4 w-4 shrink-0" />
                  <span className="truncate">Máy chính (100%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMachineMode('SECOND')}
                  className={`flex min-h-[48px] min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-extrabold transition-colors ${
                    machineMode === 'SECOND' || effectivePayroll.effectiveMachineMode === 'SECOND'
                      ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                      : 'border-industrial-border bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="h-4 w-4 shrink-0" />
                  <span className="truncate">Ghép máy 2 (0.33)</span>
                </button>
              </div>
            </Card>

            {/* 4. Tech Spec Card + Self-Check ★ */}
            {selectedOp && (
              <Card className="space-y-3 border-industrial-border bg-slate-900/90 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-300">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>Hướng Dẫn Công Nghệ &amp; Tự Kiểm</span>
                  </div>
                  {selectedPo && (
                    <span className="font-mono-num text-xs font-bold text-slate-300">
                      Tiến độ PO: <strong className="text-emerald-400">{selectedPo.finishedQty}</strong> /{' '}
                      {selectedPo.qtyPo} SP (NC đã làm: {opDoneSoFar})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-industrial-border bg-slate-950/80 p-2.5">
                    <div className="text-[11px] text-slate-400">Phôi / Vật liệu</div>
                    <div className="mt-0.5 break-words font-semibold text-slate-100">
                      {selectedOp.matName || 'Thép chế tạo máy'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-industrial-border bg-slate-950/80 p-2.5">
                    <div className="text-[11px] text-slate-400">Chế độ cắt chuẩn (Vc / f)</div>
                    <div className="font-mono-num mt-0.5 break-words font-semibold text-amber-300">
                      {selectedOp.cuttingRec || 'Theo phiếu công nghệ xưởng'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-industrial-border bg-slate-950/80 p-2.5">
                    <div className="text-[11px] text-slate-400">Dao cụ định mức</div>
                    <div className="mt-0.5 break-words font-semibold text-sky-300">
                      {selectedOp.toolCode ? `${selectedOp.toolCode} — ${selectedOp.toolName}` : 'Dao tiêu chuẩn'}
                    </div>
                  </div>
                </div>

                {/* Soft Warnings */}
                {combinedWarnings.length > 0 && (
                  <div className="space-y-1 rounded-xl border border-amber-500/50 bg-amber-950/40 p-2.5 text-xs text-amber-200">
                    {combinedWarnings.map((w, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Large Touch Self-Check ★ Toggle */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selfCheckOk}
                  onClick={() => setSelfCheckOk((v) => !v)}
                  className={`flex min-h-[52px] w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                    selfCheckOk
                      ? 'border-emerald-500/60 bg-emerald-950/35 text-emerald-100'
                      : 'border-amber-500/80 bg-amber-950/50 text-amber-100'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Star
                      className={`h-5 w-5 shrink-0 ${
                        selfCheckOk ? 'fill-amber-400 text-amber-400' : 'text-amber-300'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold sm:text-sm">
                        ★ Đã tự kiểm kích thước quan trọng (Self-Check)
                      </div>
                      <div className="text-[11px] opacity-80">
                        {selectedOp.isCriticalCheck === 1
                          ? 'Nguyên công bắt buộc đo kiểm thước cặp / panme trước khi tháo phôi'
                          : 'Xác nhận bề mặt & kích thước đạt yêu cầu bản vẽ'}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-bold ${
                      selfCheckOk
                        ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                        : 'border-amber-400 bg-slate-950 text-transparent'
                    }`}
                  >
                    ✓
                  </div>
                </button>
              </Card>
            )}

            {/* 5. Live Shift Run Timer Strip + 3 Quantity Steppers (Zero Overflow at 360px!) */}
            <Card className="space-y-3 p-3 sm:p-4">
              {/* Optional Live Run Stopwatch vs End-of-Shift Quick Mode */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-industrial-border bg-slate-950 p-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase text-slate-400">
                    Chế độ bấm giờ chạy máy trực tiếp
                  </div>
                  <div className="font-mono-num text-sm font-extrabold text-sky-300">
                    {runTimer.isRunning || runSnap.elapsedSeconds > 0
                      ? `⏱️ Đang chạy: ${runSnap.formattedClock} (Từ ${startTime})`
                      : `Ca mặc định: ${startTime} → ${endTime}`}
                  </div>
                </div>
                {!runTimer.isRunning ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (runSnap.elapsedSeconds === 0) {
                        setStartTime(getNowVietnamHhMm());
                      }
                      setRunTimer((prev) => startPersistentStopTimer(prev, Date.now()));
                      toast.info('▶️ Đã bắt đầu bấm giờ ca chạy máy!');
                    }}
                    className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-3.5 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/30"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>▶️ Bắt đầu ca</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const nowStr = getNowVietnamHhMm();
                      setEndTime(nowStr);
                      setRunTimer((prev) => pausePersistentStopTimer(prev, Date.now()));
                      toast.success(`⏹️ Đã chốt giờ kết thúc: ${nowStr}`);
                    }}
                    className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-amber-400/60 bg-amber-500/20 px-3.5 text-xs font-extrabold text-amber-200 hover:bg-amber-500/30"
                  >
                    <Pause className="h-4 w-4" />
                    <span>⏹️ Chốt giờ</span>
                  </button>
                )}
              </div>

              {/* OK Quantity Row */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                    ✅ Sản Lượng ĐẠT Chuẩn (OK)
                  </span>
                  <div className="flex items-center gap-1">
                    {[5, 10].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => setOkQty((q) => Math.max(0, q + inc))}
                        className="min-h-[34px] rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 font-mono-num text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        +{inc}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Giảm SL Đạt"
                    onClick={() => setOkQty((q) => Math.max(0, q - 1))}
                    className="flex h-[52px] w-[56px] shrink-0 items-center justify-center rounded-xl border border-industrial-border bg-industrial-elevated text-slate-100 active:scale-95"
                  >
                    <Minus className="h-6 w-6" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label="Số lượng Đạt OK"
                    value={okQty}
                    onChange={(e) => setOkQty(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    className="font-mono-num tabular-nums h-[52px] w-full min-w-0 rounded-xl border border-emerald-500/50 bg-slate-950 px-2 text-center text-2xl font-black text-emerald-400 focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Tăng SL Đạt"
                    onClick={() => setOkQty((q) => q + 1)}
                    className="flex h-[52px] w-[56px] shrink-0 items-center justify-center rounded-xl border border-emerald-400/60 bg-emerald-500 text-slate-950 shadow active:scale-95"
                  >
                    <Plus className="h-6 w-6 stroke-[3]" />
                  </button>
                </div>
              </div>

              {/* REWORK & SCRAP Stacked Rows (Guaranteed zero horizontal overflow at 360px) */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-amber-500/35 bg-amber-950/15 p-2.5">
                  <div className="mb-1.5 text-xs font-extrabold uppercase text-amber-300">
                    🔧 Hàng Sửa Lại (Rework)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Giảm SL Sửa lại"
                      onClick={() => setReworkQty((q) => Math.max(0, q - 1))}
                      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl border border-industrial-border bg-industrial-elevated text-slate-100"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label="Số lượng Sửa lại"
                      value={reworkQty}
                      onChange={(e) =>
                        setReworkQty(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      className="font-mono-num tabular-nums h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 px-2 text-center text-xl font-extrabold text-amber-300 focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Tăng SL Sửa lại"
                      onClick={() => setReworkQty((q) => q + 1)}
                      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl border border-amber-500/50 bg-amber-500/20 text-amber-200"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0 rounded-xl border border-red-500/35 bg-red-950/15 p-2.5">
                  <div className="mb-1.5 text-xs font-extrabold uppercase text-red-300">
                    🚨 Hàng Hủy / Phế Phẩm (NG)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Giảm SL Hàng hủy"
                      onClick={() => setScrapQty((q) => Math.max(0, q - 1))}
                      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl border border-industrial-border bg-industrial-elevated text-slate-100"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label="Số lượng Hàng hủy NG"
                      value={scrapQty}
                      onChange={(e) =>
                        setScrapQty(Math.max(0, Math.round(Number(e.target.value) || 0)))
                      }
                      className="font-mono-num tabular-nums h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 px-2 text-center text-xl font-extrabold text-red-400 focus:border-red-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Tăng SL Hàng hủy"
                      onClick={() => setScrapQty((q) => q + 1)}
                      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl border border-red-500/50 bg-red-500/25 text-red-200"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto-Expanding NG Scrap Classification Panel */}
              {scrapQty > 0 && (
                <div className="space-y-2.5 rounded-xl border-2 border-red-500/60 bg-red-950/40 p-3">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-red-200">
                    ⚠️ Phân Loại Nguyên Nhân Hàng Hủy ({scrapQty} SP NG)
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setDefectType('Lỗi Phôi Đúc / Nguyên liệu')}
                      className={`min-h-[50px] w-full rounded-xl border p-2.5 text-left text-xs transition-colors ${
                        defectType.includes('Phôi')
                          ? 'border-emerald-400 bg-emerald-950/60 text-emerald-100'
                          : 'border-industrial-border bg-slate-950/80 text-slate-300'
                      }`}
                    >
                      <div className="font-extrabold">
                        🪨 Lỗi Phôi Đúc / Rỗ Khí Nguyên Liệu (Khách quan)
                      </div>
                      <div className="mt-0.5 text-[11px] opacity-85">
                        Được hỗ trợ 50% giờ công định mức, KHÔNG trừ phạt lương thợ
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDefectType('Lỗi Chủ quan Cơ khí')}
                      className={`min-h-[50px] w-full rounded-xl border p-2.5 text-left text-xs transition-colors ${
                        !defectType.includes('Phôi')
                          ? 'border-red-400 bg-red-950/70 text-red-100'
                          : 'border-industrial-border bg-slate-950/80 text-slate-300'
                      }`}
                    >
                      <div className="font-extrabold">
                        ⚠️ Lỗi Chủ Quan Gia Công Cơ Khí (Hụt dung sai / Gãy dao)
                      </div>
                      <div className="mt-0.5 text-[11px] opacity-85">
                        Tính khấu trừ lũy tiến bậc thang (50% / 40% / 30%) &amp; chuyển Chờ QC duyệt
                      </div>
                    </button>
                  </div>

                  {!defectType.includes('Phôi') && (
                    <div className="space-y-1">
                      <label className="flex items-center justify-between text-xs font-bold text-red-200">
                        <span>Giá trị thiệt hại ước tính (VNĐ)</span>
                        <span className="font-mono-num text-red-300">
                          Phạt dự kiến: -{formatVnd(effectivePayroll.scrapPenalty)}
                        </span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={damageValue}
                        onChange={(e) => {
                          setIsDamageDirty(true);
                          setDamageValue(Math.max(0, Number(e.target.value) || 0));
                        }}
                        className="font-mono-num min-h-[48px] w-full min-w-0 rounded-xl border border-red-400/50 bg-slate-950 px-3 text-sm font-bold text-red-200"
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* 6. FOUR PROGRESSIVE DISCLOSURE ACCORDIONS */}
            <div className="space-y-2">
              {/* Accordion 1: Stop Timer & Machine Incident */}
              <div className="overflow-hidden rounded-xl border border-industrial-border bg-industrial-surface">
                <button
                  type="button"
                  onClick={() => setOpenStopSection((v) => !v)}
                  className="flex min-h-[52px] w-full min-w-0 items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-slate-800/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Timer className="h-5 w-5 shrink-0 text-amber-400" />
                    <span className="truncate text-sm font-bold text-slate-100">
                      ⏱️ Dừng máy / Sự cố
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {(stopMinutes > 0 || stopTimer.isRunning || stopSnap.elapsedSeconds > 0) && (
                      <Badge variant="warning" className="font-mono-num">
                        {stopTimer.isRunning ? `Đang bấm ${stopSnap.formattedClock}` : `${stopMinutes}p`}
                      </Badge>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${openStopSection ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {openStopSection && (
                  <div className="space-y-3 border-t border-industrial-border bg-slate-950/60 p-3.5">
                    {/* Persistent Date.now() Stopwatch */}
                    <div className="rounded-xl border border-amber-500/40 bg-slate-900 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-400">
                            Đồng hồ dừng máy bền vững (tắt màn hình không mất giờ)
                          </div>
                          <div
                            data-testid="persistent-stop-clock"
                            className="font-mono-num tabular-nums mt-0.5 text-2xl font-black text-amber-300"
                          >
                            {stopSnap.formattedClock}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {!stopTimer.isRunning ? (
                            <Button
                              type="button"
                              variant="warning"
                              size="lg"
                              onClick={() =>
                                setStopTimer((prev) => startPersistentStopTimer(prev, Date.now()))
                              }
                            >
                              <Play className="h-4 w-4 fill-current" /> Bấm giờ
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="lg"
                              onClick={() => {
                                const next = pausePersistentStopTimer(stopTimer, Date.now());
                                setStopTimer(next);
                                setStopMinutes(computeStopTimerElapsed(next, Date.now()).elapsedMinutes);
                              }}
                            >
                              <Pause className="h-4 w-4" /> Tạm dừng
                            </Button>
                          )}

                          {stopSnap.elapsedSeconds > 0 && (
                            <Button
                              type="button"
                              variant="success"
                              size="lg"
                              onClick={() => {
                                setStopMinutes(stopSnap.elapsedMinutes);
                                if (!isObjectiveStopReason(stopReason)) {
                                  setStopReason('Chờ phôi / Chờ cẩu');
                                }
                                toast.success(`Đã nạp ${stopSnap.elapsedMinutes} phút dừng máy!`);
                              }}
                            >
                              Lấy {stopSnap.elapsedMinutes}p
                            </Button>
                          )}

                          {(stopSnap.elapsedSeconds > 0 || stopMinutes > 0) && (
                            <button
                              type="button"
                              onClick={() => {
                                setStopTimer(resetPersistentStopTimer());
                                setStopMinutes(0);
                                setStopReason('Không có dừng máy');
                              }}
                              className="flex h-12 w-12 items-center justify-center rounded-xl border border-industrial-border bg-slate-800 text-slate-300 hover:text-white"
                              aria-label="Xóa đồng hồ dừng máy"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 4 Quick Preset Minute Pills + Manual Input */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {[15, 30, 45, 60].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setStopMinutes(m);
                            if (stopReason === 'Không có dừng máy') {
                              setStopReason('Chờ phôi / Chờ cẩu');
                            }
                          }}
                          className={`font-mono-num min-h-[48px] rounded-xl border text-xs font-extrabold ${
                            stopMinutes === m
                              ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                              : 'border-industrial-border bg-industrial-elevated text-slate-200'
                          }`}
                        >
                          {m}p
                        </button>
                      ))}
                      <input
                        type="number"
                        min={0}
                        max={480}
                        value={stopMinutes}
                        onChange={(e) =>
                          setStopMinutes(Math.max(0, Math.round(Number(e.target.value) || 0)))
                        }
                        aria-label="Số phút dừng máy"
                        className="font-mono-num min-h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 px-1.5 text-center text-sm font-bold text-amber-300"
                      />
                    </div>

                    {/* Stop Reasons */}
                    <div className="space-y-1.5">
                      {STOP_REASONS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setStopReason(r.value)}
                          className={`flex min-h-[48px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs ${
                            stopReason === r.value
                              ? 'border-sky-400 bg-sky-500/15 text-slate-50'
                              : 'border-industrial-border bg-industrial-elevated/70 text-slate-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold">{r.label}</div>
                            <div className="text-[11px] text-slate-400">{r.sub}</div>
                          </div>
                          {r.paid && (
                            <Badge variant="success" className="shrink-0">
                              100% CB
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 2: Shift, Overtime & Lights-Out */}
              <div className="overflow-hidden rounded-xl border border-industrial-border bg-industrial-surface">
                <button
                  type="button"
                  onClick={() => setOpenShiftSection((v) => !v)}
                  className="flex min-h-[52px] w-full min-w-0 items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-slate-800/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Clock className="h-5 w-5 shrink-0 text-sky-400" />
                    <span className="truncate text-sm font-bold text-slate-100">
                      🌙 Ca làm việc, Tăng ca &amp; Lights-out
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isSundaySelected && <Badge variant="danger">CN 2.0x</Badge>}
                    {overtimeMinutes > 0 && <Badge variant="info">OT {overtimeMinutes}p</Badge>}
                    {isLightsOut && <Badge variant="purple">🌙 Đêm</Badge>}
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${openShiftSection ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {openShiftSection && (
                  <div className="space-y-3 border-t border-industrial-border bg-slate-950/60 p-3.5">
                    {/* Work Date + Auto Sunday Detection */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-300">
                        Ngày làm việc (Giờ VN):
                      </label>
                      <div className="flex items-center gap-2">
                        {isSundaySelected && (
                          <Badge variant="warning">🌞 Chủ nhật hệ số 2.0x</Badge>
                        )}
                        <input
                          type="date"
                          value={workDate}
                          onChange={(e) => setWorkDate(e.target.value)}
                          className="font-mono-num min-h-[48px] rounded-xl border border-industrial-border bg-slate-950 px-3 text-sm font-bold text-slate-100"
                        />
                      </div>
                    </div>

                    {/* 4 Shift Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      {SHIFT_OPTIONS.map((sh) => (
                        <button
                          key={sh.value}
                          type="button"
                          onClick={() => {
                            setShiftType(sh.value);
                            const preset = getShiftPresetTimes(sh.value);
                            setStartTime(preset.startTime);
                            setEndTime(preset.endTime);
                          }}
                          className={`flex min-h-[48px] min-w-0 flex-col items-start justify-center rounded-xl border px-3 py-1.5 text-left ${
                            shiftType === sh.value
                              ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                              : 'border-industrial-border bg-industrial-elevated text-slate-300'
                          }`}
                        >
                          <span className="truncate text-xs font-extrabold">{sh.shortLabel}</span>
                          <span className="font-mono-num text-[11px] text-sky-300">{sh.badge}</span>
                        </button>
                      ))}
                    </div>

                    {/* Spacious Start/End Time Inputs (Never clips minutes!) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="min-w-0">
                        <label className="mb-1 block text-xs font-bold text-slate-400">
                          Giờ bắt đầu ca
                        </label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="font-mono-num min-h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 px-3 text-sm font-bold text-slate-100"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-1 block text-xs font-bold text-slate-400">
                          Giờ kết thúc ca
                        </label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="font-mono-num min-h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 px-3 text-sm font-bold text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Overtime Stepper (15m steps, 0 - 240m) */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-300">
                        <span>Tăng ca (Bước 15 phút · Tối đa 240p)</span>
                        <span className="font-mono-num text-sky-300">
                          {overtimeMinutes} phút ({(overtimeMinutes / 60).toFixed(2)}h)
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[0, 60, 120, 180, 240].map((ot) => (
                          <button
                            key={ot}
                            type="button"
                            onClick={() => setOvertimeMinutes(ot)}
                            className={`font-mono-num min-h-[48px] rounded-xl border text-xs font-extrabold ${
                              overtimeMinutes === ot
                                ? 'border-sky-400 bg-sky-500/25 text-sky-200'
                                : 'border-industrial-border bg-industrial-elevated text-slate-300'
                            }`}
                          >
                            {ot}p
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Lights-Out Night Run Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isLightsOut}
                      onClick={() => setIsLightsOut((v) => !v)}
                      className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left ${
                        isLightsOut
                          ? 'border-purple-400 bg-purple-950/50 text-purple-100'
                          : 'border-industrial-border bg-industrial-elevated text-slate-300'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Moon className="h-5 w-5 shrink-0 text-purple-400" />
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold">
                            🌙 Chạy tự động qua đêm (Lights-out Machining)
                          </div>
                          <div className="text-[11px] opacity-80">
                            Gá phôi lớn chu kỳ dài để máy CNC tự chạy không người trực
                          </div>
                        </div>
                      </div>
                      <Badge variant={isLightsOut ? 'purple' : 'neutral'}>
                        {isLightsOut ? 'ĐANG BẬT' : 'TẮT'}
                      </Badge>
                    </button>
                  </div>
                )}
              </div>

              {/* Accordion 3: Cutting Tools & 1-for-1 Swap */}
              <div className="overflow-hidden rounded-xl border border-industrial-border bg-industrial-surface">
                <button
                  type="button"
                  onClick={() => setOpenToolSection((v) => !v)}
                  className="flex min-h-[52px] w-full min-w-0 items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-slate-800/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Wrench className="h-5 w-5 shrink-0 text-emerald-400" />
                    <span className="truncate text-sm font-bold text-slate-100">
                      🔪 Dao cụ &amp; Đổi chíp 1-đổi-1
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={toolEdgesState.isEdgesDirty ? 'warning' : 'neutral'}>
                      {toolCode || 'Chưa chọn'} · {formatNumber(toolEdgesState.edgesUsed)} cạnh
                    </Badge>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${openToolSection ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {openToolSection && (
                  <div className="space-y-3 border-t border-industrial-border bg-slate-950/60 p-3.5">
                    <button
                      type="button"
                      onClick={() => setActivePicker('TOOL')}
                      className="flex min-h-[50px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-industrial-border bg-industrial-elevated p-3 text-left hover:border-sky-400"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-slate-400">Mã mảnh dao cụ đang dùng</div>
                        <div className="truncate text-sm font-bold text-slate-100">
                          {selectedTool
                            ? `${selectedTool.code} — ${selectedTool.name} (Tồn: ${selectedTool.stockQty ?? 0})`
                            : toolCode || 'Chọn mã dao cụ (63 mã)...'}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                    </button>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-300">
                          Số cạnh dao tiêu hao thực tế:
                        </span>
                        {toolEdgesState.isEdgesDirty ? (
                          <button
                            type="button"
                            onClick={() =>
                              setToolEdgesState(
                                syncAutoToolEdges(
                                  toolEdgesState,
                                  okQty,
                                  selectedOp?.stdEdgesPerPcs ?? 0,
                                  true
                                )
                              )
                            }
                            className="font-semibold text-amber-300 underline"
                          >
                            Đã sửa tay — Đặt lại theo ĐM
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Tự động = {okQty} SP × {selectedOp?.stdEdgesPerPcs ?? 0} cạnh/SP
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={toolEdgesState.edgesUsed}
                        onChange={(e) =>
                          setToolEdgesState((prev) =>
                            applyManualToolEdges(prev, Number(e.target.value))
                          )
                        }
                        className="font-mono-num min-h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 px-3 text-sm font-bold text-emerald-300"
                      />
                    </div>

                    {/* 1-for-1 Insert Swap Box */}
                    <div className="space-y-2.5 rounded-xl border border-sky-500/35 bg-sky-950/20 p-3">
                      <div className="text-xs font-extrabold uppercase text-sky-300">
                        🔄 Cấp Phát Đổi Mảnh Chíp Mới (Quy tắc 1-Đổi-1)
                      </div>
                      <button
                        type="button"
                        onClick={() => setOldInsertReturned((v) => !v)}
                        className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl border border-industrial-border bg-slate-950 px-3 text-left text-xs font-semibold text-slate-200"
                      >
                        <span>Đã nộp lại xác mảnh chíp mòn/vỡ cũ 1-1</span>
                        <Badge variant={oldInsertReturned ? 'success' : 'danger'}>
                          {oldInsertReturned ? 'ĐÃ TRẢ XÁC' : 'CHƯA TRẢ'}
                        </Badge>
                      </button>
                      <input
                        type="text"
                        value={swapReason}
                        onChange={(e) => setSwapReason(e.target.value)}
                        placeholder="Lý do đổi chíp..."
                        className="min-h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 px-3 text-xs text-slate-100"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        disabled={swappingTool}
                        onClick={() => void handleToolSwap()}
                        className="w-full border-sky-400/50 text-sky-200"
                      >
                        <Wrench className="h-4 w-4 text-sky-400" />
                        {swappingTool ? 'Đang ghi nhận kho dao...' : `Đổi 1 Mảnh [${toolCode || 'Dao'}] Mới Ngay`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 4: Photo Proof & Shift Handover Note */}
              <div className="overflow-hidden rounded-xl border border-industrial-border bg-industrial-surface">
                <button
                  type="button"
                  onClick={() => setOpenPhotoSection((v) => !v)}
                  className="flex min-h-[52px] w-full min-w-0 items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-slate-800/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Camera className="h-5 w-5 shrink-0 text-purple-400" />
                    <span className="truncate text-sm font-bold text-slate-100">
                      📸 Ảnh minh chứng &amp; Ghi chú bàn giao ca
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {(photoBase64 || handoverNote.trim()) && (
                      <Badge variant="purple">Đã đính kèm</Badge>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${openPhotoSection ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {openPhotoSection && (
                  <div className="space-y-3 border-t border-industrial-border bg-slate-950/60 p-3.5">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-300">
                        Ảnh chụp chi tiết hoàn thành / biên bản đo (Tự nén nhẹ &lt;300KB)
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-sky-500/15 px-4 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25">
                          <Camera className="h-4 w-4" />
                          <span>
                            {compressingPhoto
                              ? 'Đang nén ảnh...'
                              : photoBase64
                                ? 'Chụp / Chọn lại ảnh khác'
                                : '📷 Chụp / Tải Ảnh Minh Chứng'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoChange}
                            className="hidden"
                          />
                        </label>
                        {photoBase64 && (
                          <button
                            type="button"
                            onClick={() => setPhotoBase64('')}
                            className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/40 bg-red-950/40 text-red-300"
                            aria-label="Xóa ảnh đính kèm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {photoBase64 && (
                        <img
                          src={photoBase64}
                          alt="Ảnh minh chứng sản phẩm"
                          className="mt-2 max-h-48 w-auto rounded-xl border border-industrial-border object-contain"
                        />
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-400">
                        Mã lô phôi / Vật liệu truy xuất (Lot Traceability)
                      </label>
                      <input
                        type="text"
                        value={materialLot}
                        onChange={(e) => setMaterialLot(e.target.value)}
                        placeholder="VD: LOT-VICO-2610-001"
                        className="font-mono-num min-h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 px-3 text-sm text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-amber-300">
                        Ghi chú bàn giao cho ca sau (Sẽ hiện Banner Vàng trên máy {machineName})
                      </label>
                      <textarea
                        rows={2}
                        value={handoverNote}
                        onChange={(e) => setHandoverNote(e.target.value)}
                        placeholder="VD: Đang gá dở phôi số 4, chú ý bù mòn dao T03 -0.02mm..."
                        className="w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 7. PRIMARY 56PX SUBMIT REPORT BUTTON */}
            <button
              type="button"
              disabled={submittingReport}
              onClick={() => void handleSubmitReport()}
              className="flex min-h-[56px] w-full min-w-0 items-center justify-center gap-2.5 rounded-2xl border border-emerald-300/60 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 px-5 py-3.5 text-base font-black tracking-wide text-slate-950 shadow-xl shadow-emerald-950/70 transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
            >
              <Rocket className="h-6 w-6 shrink-0" />
              <span className="truncate">
                {submittingReport
                  ? 'ĐANG GHI NHẬN SẢN LƯỢNG...'
                  : `🚀 GỬI BÁO CÁO SẢN LƯỢNG (+${formatVnd(effectivePayroll.turnTotalIncome)})`}
              </span>
            </button>
          </>
        )}

        {/* ==================== TAB 2: 📋 LỆNH SX & DUYỆT CON ĐẦU (FAI) ==================== */}
        {activeTab === 'ORDERS_FAI' && (
          <div className="space-y-3">
            <Card className="space-y-3 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-slate-50">
                  📋 Lệnh Sản Xuất Mở &amp; Duyệt Mẫu Đầu (FAI)
                </h2>
                <Badge variant={pendingFaiCount > 0 ? 'warning' : 'success'}>
                  {pendingFaiCount} lô chờ FAI (SL &ge; 5)
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Đơn mở (${ordersList.filter((o) => o.remainQty > 0).length})` },
                    { id: 'PENDING_FAI', label: `Chờ FAI (${pendingFaiCount})` },
                    { id: 'SCHEDULE', label: `Lịch máy (${schedulesList.length})` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrdersFilter(f.id)}
                    className={`min-h-[48px] rounded-xl border px-2 text-xs font-extrabold ${
                      ordersFilter === f.id
                        ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                        : 'border-industrial-border bg-industrial-elevated text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {ordersFilter !== 'SCHEDULE' && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={ordersSearch}
                    onChange={(e) => setOrdersSearch(e.target.value)}
                    placeholder="Tìm mã PO, khách hàng, bản vẽ..."
                    className="min-h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 pl-10 pr-3 text-sm text-slate-100"
                  />
                </div>
              )}
            </Card>

            {ordersFilter === 'SCHEDULE' ? (
              <div className="space-y-2.5">
                {schedulesList.map((sch) => (
                  <Card key={sch.id} className="space-y-2.5 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="info">{sch.machineName}</Badge>
                        <Badge variant="neutral">{sch.shiftType}</Badge>
                        {sch.isLightsOut === 1 && <Badge variant="purple">🌙 Lights-out</Badge>}
                      </div>
                      <span className="font-mono-num text-xs font-bold text-emerald-300">
                        KH: {sch.plannedQty} SP ({sch.plannedHours}h)
                      </span>
                    </div>
                    <div className="break-words text-sm font-extrabold text-slate-100">
                      {sch.poId} — {sch.productName || 'Chi tiết cơ khí'}
                    </div>
                    <div className="text-xs text-slate-400">
                      Nguyên công: <strong className="text-sky-300">{sch.ncId}</strong> —{' '}
                      {sch.opName} · Dao: {sch.toolCode || '—'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        onClick={() => handleQrDetected(`GCCK|${sch.poId}|${sch.ncId}`)}
                      >
                        ⚡ Nạp Báo Cáo SX
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        onClick={() => navigateTo(`/print/traveler/${encodeURIComponent(sch.poId)}`)}
                      >
                        <Printer className="h-4 w-4" /> In Phiếu QR
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTab2Orders.slice(0, 60).map((po) => {
                  const pct =
                    po.qtyPo > 0 ? Math.min(100, Math.round((po.finishedQty / po.qtyPo) * 100)) : 0;
                  const needsFai = po.qtyPo >= 5 && po.faiStatus !== 'FAI_PASSED';
                  return (
                    <Card key={po.poId} className="space-y-2.5 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 font-mono-num text-xs font-extrabold text-sky-300">
                            {po.poId}
                          </span>
                          <Badge variant="neutral">{po.customer}</Badge>
                          {po.faiStatus === 'FAI_PASSED' ? (
                            <Badge variant="success">✅ Đã duyệt FAI</Badge>
                          ) : needsFai ? (
                            <Badge variant="warning">⏳ Chờ duyệt FAI</Badge>
                          ) : (
                            <Badge variant="neutral">Lô &lt; 5 SP</Badge>
                          )}
                        </div>
                        <span className="font-mono-num text-xs text-slate-400">
                          Hạn: {formatDateVn(po.dueDate)}
                        </span>
                      </div>

                      <div className="break-words text-sm font-extrabold text-slate-50">
                        {po.productName}
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between font-mono-num text-xs text-slate-300">
                          <span>
                            Hoàn thành: <strong>{po.finishedQty}</strong> / {po.qtyPo} SP (WIP:{' '}
                            {po.wipQty})
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
                        <Button
                          type="button"
                          variant="primary"
                          size="lg"
                          onClick={() => {
                            handleSelectPo(po.poId);
                            setActiveTab('REPORT');
                            toast.info(`Đã nạp Lệnh SX ${po.poId}`);
                          }}
                        >
                          ⚡ Báo Cáo PO
                        </Button>

                        <Button
                          type="button"
                          variant={needsFai ? 'warning' : 'secondary'}
                          size="lg"
                          onClick={() => setFaiTargetPo(po)}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          {po.faiStatus === 'FAI_PASSED' ? 'Ký lại FAI' : 'Duyệt Con Đầu'}
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="lg"
                          onClick={() =>
                            navigateTo(`/print/traveler/${encodeURIComponent(po.poId)}`)
                          }
                        >
                          <Printer className="h-4 w-4" /> Phiếu QR
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: 💰 LƯƠNG & LỊCH SỬ CÁ NHÂN ==================== */}
        {activeTab === 'SALARY_HISTORY' && (
          <div className="space-y-3">
            {/* Personal Summary Card */}
            <Card className="space-y-3 border-emerald-500/35 bg-gradient-to-br from-slate-900 to-industrial-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Hồ Sơ Thu Nhập Cá Nhân (Bảo Mật 1-1)
                  </div>
                  <h2 className="mt-0.5 truncate text-lg font-extrabold text-slate-50">
                    {user ? `${user.name} (${user.workerId})` : 'Chưa đăng nhập'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {user ? `${user.title} · Chế độ: ${user.salaryMode}` : 'Vui lòng mở khóa PIN'}
                  </p>
                </div>
                <ShieldCheck className="h-7 w-7 shrink-0 text-emerald-400" />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-industrial-border bg-slate-950 p-3">
                  <div className="text-[11px] text-slate-400">Thu nhập đã ghi nhận hôm nay</div>
                  <div className="font-mono-num tabular-nums mt-1 text-xl font-black text-emerald-400">
                    {formatVnd(myTodayIncome)}
                  </div>
                </div>
                <div className="rounded-xl border border-industrial-border bg-slate-950 p-3">
                  <div className="text-[11px] text-slate-400">Số phiếu đã gửi gần đây</div>
                  <div className="font-mono-num tabular-nums mt-1 text-xl font-black text-sky-300">
                    {myRecentLogs.length} lượt
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setTelegramModalOpen(true)}
                className="w-full"
              >
                <MessageCircle className="h-4 w-4 text-sky-400" />
                {user?.isLinked
                  ? `Đã nối Telegram 1-1 (Chat ID: ${user.chatId}) — Bấm để đổi`
                  : '📲 Cài đặt nhận phiếu lương ca qua Telegram 1-1'}
              </Button>
            </Card>

            {/* Offline Outbox Queue Card */}
            {outboxItems.length > 0 && (
              <Card className="space-y-2.5 border-amber-500/50 bg-amber-950/30 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-amber-200">
                    🟠 Hàng Đợi Ngoại Tuyến ({outboxItems.length} phiếu chờ đồng bộ)
                  </div>
                  <Button
                    type="button"
                    variant="warning"
                    size="lg"
                    disabled={syncingOutbox}
                    onClick={() => void handleManualFlushOutbox()}
                  >
                    <RefreshCw className={`h-4 w-4 ${syncingOutbox ? 'animate-spin' : ''}`} />
                    Đồng bộ ngay
                  </Button>
                </div>
                {outboxItems.map((q) => (
                  <div
                    key={q.recordUid}
                    className="rounded-lg border border-amber-500/30 bg-slate-950/80 p-2.5 text-xs text-slate-200"
                  >
                    <div className="font-mono-num font-bold text-amber-300">{q.recordUid}</div>
                    <div>
                      PO: {q.payload.poId} · NC: {q.payload.ncId} · Đạt: {q.payload.okQty} OK /{' '}
                      {q.payload.scrapQty || 0} NG
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* Personal Recent Logs */}
            <Card className="space-y-2.5 p-3.5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-100">
                  <History className="h-4 w-4 text-sky-400" />
                  <span>Lịch Sử Báo Cáo Của Tôi</span>
                </h3>
                <span className="text-xs text-slate-400">{myRecentLogs.length} bản ghi</span>
              </div>

              {myRecentLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-industrial-border py-8 text-center text-xs text-slate-400">
                  Chưa có phiếu báo cáo nào trong phiên của {user?.name || 'bạn'}.
                </div>
              ) : (
                <div className="space-y-2">
                  {myRecentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="space-y-1.5 rounded-xl border border-industrial-border bg-slate-950/80 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-num text-xs font-bold text-sky-300">
                            {log.timeStr || log.workDate}
                          </span>
                          <Badge variant="neutral">{log.machineName}</Badge>
                        </div>
                        <span className="font-mono-num tabular-nums text-sm font-extrabold text-emerald-400">
                          +{formatVnd(log.income)}
                        </span>
                      </div>
                      <div className="break-words text-xs font-bold text-slate-100">
                        [{log.poId}] {log.ncId} — {log.opName} ({log.productName})
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span className="font-mono-num">
                          OK: <strong className="text-emerald-300">{log.okQty}</strong> · Sửa:{' '}
                          {log.reworkQty} · NG:{' '}
                          <strong className="text-red-300">{log.scrapQty}</strong>
                          {log.stopMinutes > 0 ? ` · Dừng: ${log.stopMinutes}p` : ''}
                        </span>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={
                              log.kpiPct >= 85 ? 'success' : log.kpiPct > 0 ? 'warning' : 'info'
                            }
                          >
                            {log.kpiStatus}
                          </Badge>
                          {log.qcStatus !== 'PASSED' && (
                            <Badge variant="warning">{log.qcStatus}</Badge>
                          )}
                        </div>
                      </div>
                      {log.photoUrl && (
                        <a
                          href={log.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400 underline"
                        >
                          📸 Xem ảnh đính kèm
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      {/* ==================== FIXED 64PX BOTTOM NAVIGATION BAR ==================== */}
      <nav
        aria-label="Điều hướng Cổng Công Nhân"
        className="no-print fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-industrial-border bg-slate-950/95 backdrop-blur-md"
      >
        <div className="mx-auto grid h-full max-w-3xl grid-cols-3 gap-1 px-2">
          <button
            type="button"
            onClick={() => setActiveTab('REPORT')}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-extrabold transition-colors ${
              activeTab === 'REPORT'
                ? 'text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="h-5 w-5" />
            <span className="truncate">⚡ Báo Cáo SX</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ORDERS_FAI')}
            className={`relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-extrabold transition-colors ${
              activeTab === 'ORDERS_FAI'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardCheck className="h-5 w-5" />
            <span className="truncate">📋 Lệnh SX &amp; FAI</span>
            {pendingFaiCount > 0 && (
              <span className="font-mono-num absolute right-3 top-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-slate-950">
                {pendingFaiCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SALARY_HISTORY')}
            className={`relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-extrabold transition-colors ${
              activeTab === 'SALARY_HISTORY'
                ? 'text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="h-5 w-5" />
            <span className="truncate">💰 Lương &amp; Cá Nhân</span>
            {outboxItems.length > 0 && (
              <span className="font-mono-num absolute right-3 top-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-slate-950">
                {outboxItems.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* ==================== MODALS & BOTTOM-SHEET PICKERS ==================== */}
      <QrScannerModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        onDetected={handleQrDetected}
        samplePresets={sampleQrPresets}
      />

      {pickerConfig && (
        <SearchablePickerSheet
          open={Boolean(activePicker)}
          onClose={() => setActivePicker(null)}
          title={pickerConfig.title}
          subtitle={pickerConfig.subtitle}
          options={pickerConfig.options}
          selectedId={pickerConfig.selectedId}
          onSelect={pickerConfig.onSelect}
        />
      )}

      <TelegramLinkModal
        open={telegramModalOpen}
        onClose={() => setTelegramModalOpen(false)}
        user={user}
        botUsername={String(bootstrap?.config?.TELEGRAM_BOT_USERNAME || '')}
        onLinked={async () => {
          await refreshSession();
          await loadBootstrapData(true);
        }}
      />

      <FaiInspectionModal
        open={Boolean(faiTargetPo)}
        onClose={() => setFaiTargetPo(null)}
        po={faiTargetPo}
        operations={operationsList}
        user={user}
        authMode={authMode}
        onSwitchToQc={async () => {
          await quickSwitch({ workerId: 'NV_KT02' });
          toast.info('Đã chuyển sang quyền Tổ Trưởng / QC (Nguyễn Văn Duy)');
        }}
        onOpenPinForQc={() => {
          setFaiTargetPo(null);
          openPinModal('NV_KT02');
        }}
        onSuccess={() => loadBootstrapData(true)}
      />
    </div>
  );
}

export default WorkerPortal;
