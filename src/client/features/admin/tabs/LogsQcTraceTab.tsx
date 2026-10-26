import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  FileSpreadsheet,
  GitCommit,
  Microscope,
  PackageCheck,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import type {
  ProductionLogDto,
  QcInspectionDto,
  TraceabilityDto,
} from '@shared/types';
import { matchesSearch, normalizeVn } from '@shared/vnSearch';
import { apiClient } from '@client/lib/apiClient';
import { downloadDailyLogsExcel } from '@client/lib/excelService';
import {
  formatDateVn,
  formatNumber,
  formatVnd,
  normalizeQcMeasuredDims,
} from '@client/lib/formatters';
import { navigateTo } from '@client/lib/navigation';
import {
  Badge,
  Button,
  Card,
  Modal,
  PaginationBar,
  useToast,
} from '@client/components/ui/IndustrialPrimitives';
import { useAuth } from '@client/context/AuthContext';
import type { AdminTabCommonProps } from '../types';

type SubViewMode = 'LOGS' | 'QC' | 'TRACE';
type LogIssueFilter = 'ALL' | 'HAS_NG' | 'PENDING_QC' | 'HANDOVER' | 'VOIDED';

interface MeasuredDimRow {
  feature: string;
  nominal: number;
  tolPlusMinus: number;
  measured: number;
}

export function LogsQcTraceTab({
  bootstrap,
  onRefreshBootstrap,
  deepLink,
}: AdminTabCommonProps) {
  const toast = useToast();
  const { user } = useAuth();
  const canEditLogs = user?.appRole === 'ADMIN' || user?.appRole === 'SHIFT_LEADER';

  const [subView, setSubView] = useState<SubViewMode>(deepLink?.logsSubView || 'LOGS');

  // ==================== SUB-VIEW A: LOGS STATE ====================
  const [logs, setLogs] = useState<ProductionLogDto[]>(bootstrap.recentLogs || []);
  const [logSearch, setLogSearch] = useState('');
  const [logDateFilter, setLogDateFilter] = useState('');
  const [logShiftFilter, setLogShiftFilter] = useState('ALL');
  const [logWorkerFilter, setLogWorkerFilter] = useState('ALL');
  const [logMachineFilter, setLogMachineFilter] = useState('ALL');
  const [logIssueFilter, setLogIssueFilter] = useState<LogIssueFilter>('ALL');
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(50);
  const [exportingLogs, setExportingLogs] = useState(false);

  // Edit / Void Log Modal
  const [editLog, setEditLog] = useState<ProductionLogDto | null>(null);
  const [editOkQty, setEditOkQty] = useState(0);
  const [editReworkQty, setEditReworkQty] = useState(0);
  const [editScrapQty, setEditScrapQty] = useState(0);
  const [editQcStatus, setEditQcStatus] = useState<'PASSED' | 'PENDING_QC' | 'NG_HOLD'>('PASSED');
  const [editIsVoided, setEditIsVoided] = useState(false);
  const [savingLogEdit, setSavingLogEdit] = useState(false);

  // Photo Preview Modal
  const [previewPhotoLog, setPreviewPhotoLog] = useState<ProductionLogDto | null>(null);

  // ==================== SUB-VIEW B: QC 3-TIER STATE ====================
  const [qcList, setQcList] = useState<QcInspectionDto[]>(bootstrap.qcInspections || []);
  const [qcTypeFilter, setQcTypeFilter] = useState<string>('ALL');
  const [qcSearch, setQcSearch] = useState('');
  const [qcPage, setQcPage] = useState(1);
  const [qcPageSize, setQcPageSize] = useState(25);

  // Create QC Modal State
  const [createQcOpen, setCreateQcOpen] = useState(false);
  const [qcInspType, setQcInspType] = useState<'FAI' | 'IPQC' | 'OQC' | 'NG_REVIEW'>('FAI');
  const [qcPoId, setQcPoId] = useState(bootstrap.ordersList[0]?.poId || '');
  const [qcNcId, setQcNcId] = useState('');
  const [qcMachineName, setQcMachineName] = useState(bootstrap.machines[0]?.name || '');
  const [qcOperatorId, setQcOperatorId] = useState(bootstrap.workers[0]?.id || '');
  const [qcSampleSize, setQcSampleSize] = useState(3);
  const [qcDefectQty, setQcDefectQty] = useState(0);
  const [qcResult, setQcResult] = useState<'PASS' | 'CONCESSION' | 'REWORK' | 'SCRAP'>('PASS');
  const [qcRootCause, setQcRootCause] = useState('');
  const [qcCorrective, setQcCorrective] = useState('');
  const [qcDims, setQcDims] = useState<MeasuredDimRow[]>([
    { feature: 'Đường kính lỗ tinh Ø', nominal: 40.0, tolPlusMinus: 0.01, measured: 40.004 },
    { feature: 'Chiều dày bậc vai L', nominal: 25.0, tolPlusMinus: 0.02, measured: 24.992 },
  ]);
  const [submittingQc, setSubmittingQc] = useState(false);

  // ==================== SUB-VIEW C: TRACEABILITY STATE ====================
  const defaultTracePo =
    deepLink?.tracePoId || bootstrap.ordersList[0]?.poId || 'PO485-01';
  const [tracePoInput, setTracePoInput] = useState(defaultTracePo);
  const [traceData, setTraceData] = useState<TraceabilityDto | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [traceError, setTraceError] = useState('');

  useEffect(() => {
    if (deepLink?.logsSubView) setSubView(deepLink.logsSubView);
    if (deepLink?.tracePoId) {
      setTracePoInput(deepLink.tracePoId);
      void fetchTraceability(deepLink.tracePoId);
    }
  }, [deepLink?.logsSubView, deepLink?.tracePoId]);

  const reloadLogs = async () => {
    try {
      const res = await apiClient.get<{ items: ProductionLogDto[] }>('/logs?includeVoided=1');
      setLogs(res.items || []);
    } catch {
      setLogs(bootstrap.recentLogs || []);
    }
  };

  const reloadQc = async () => {
    try {
      const res = await apiClient.get<{ items: QcInspectionDto[] }>('/qc');
      setQcList(res.items || []);
    } catch {
      setQcList(bootstrap.qcInspections || []);
    }
  };

  const fetchTraceability = async (poId: string) => {
    const clean = poId.trim();
    if (!clean) return;
    setLoadingTrace(true);
    setTraceError('');
    try {
      const dto = await apiClient.get<TraceabilityDto>(
        `/orders/${encodeURIComponent(clean)}/traceability`
      );
      setTraceData(dto);
    } catch (err: any) {
      setTraceError(err?.message || `Không tìm thấy dữ liệu truy vết cho ${clean}`);
      setTraceData(null);
    } finally {
      setLoadingTrace(false);
    }
  };

  useEffect(() => {
    void reloadLogs();
    void reloadQc();
  }, []);

  useEffect(() => {
    if (subView === 'TRACE' && !traceData && tracePoInput) {
      void fetchTraceability(tracePoInput);
    }
  }, [subView]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (logIssueFilter === 'VOIDED') {
        if (!l.isVoided) return false;
      } else if (l.isVoided) {
        return false;
      }

      if (logDateFilter && l.workDate !== logDateFilter) return false;
      if (logShiftFilter !== 'ALL' && !l.shiftType.includes(logShiftFilter)) return false;
      if (logWorkerFilter !== 'ALL' && l.workerId !== logWorkerFilter) return false;
      if (logMachineFilter !== 'ALL' && l.machineName !== logMachineFilter) return false;

      if (logIssueFilter === 'HAS_NG' && l.scrapQty <= 0 && l.reworkQty <= 0) return false;
      if (logIssueFilter === 'PENDING_QC' && l.qcStatus === 'PASSED') return false;
      if (logIssueFilter === 'HANDOVER' && !l.handoverNote) return false;

      if (!logSearch.trim()) return true;
      return matchesSearch(
        `${l.recordUid} ${l.poId} ${l.customer} ${l.productName} ${l.ncId} ${l.opName} ${l.workerName} ${l.machineName} ${l.handoverNote}`,
        logSearch
      );
    });
  }, [
    logs,
    logDateFilter,
    logShiftFilter,
    logWorkerFilter,
    logMachineFilter,
    logIssueFilter,
    logSearch,
  ]);

  const pagedLogs = useMemo(() => {
    const start = (logPage - 1) * logPageSize;
    return filteredLogs.slice(start, start + logPageSize);
  }, [filteredLogs, logPage, logPageSize]);

  const openEditLogModal = (log: ProductionLogDto) => {
    setEditLog(log);
    setEditOkQty(log.okQty);
    setEditReworkQty(log.reworkQty);
    setEditScrapQty(log.scrapQty);
    setEditQcStatus(log.qcStatus);
    setEditIsVoided(Boolean(log.isVoided));
  };

  const handleSaveLogEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLog) return;
    setSavingLogEdit(true);
    try {
      await apiClient.patch(`/logs/${editLog.id}`, {
        okQty: editOkQty,
        reworkQty: editReworkQty,
        scrapQty: editScrapQty,
        qcStatus: editQcStatus,
        isVoided: editIsVoided,
      });
      toast.success(
        editIsVoided
          ? `Đã hủy phiếu nhầm #${editLog.recordUid} và hoàn trả tồn PO tự động.`
          : `Đã cập nhật phiếu sản lượng #${editLog.recordUid}.`
      );
      setEditLog(null);
      await reloadLogs();
      await onRefreshBootstrap();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể chỉnh sửa phiếu sản lượng.');
    } finally {
      setSavingLogEdit(false);
    }
  };

  const handleExportLogsExcel = async () => {
    setExportingLogs(true);
    try {
      await downloadDailyLogsExcel(filteredLogs, logDateFilter || bootstrap.vietnamToday);
      toast.success(`Đã xuất Excel 17 cột (${filteredLogs.length} bản ghi sản lượng).`);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xuất file Excel báo cáo ngày.');
    } finally {
      setExportingLogs(false);
    }
  };

  // Pending FAI POs
  const pendingFaiPos = useMemo(
    () => bootstrap.ordersList.filter((po) => po.faiStatus === 'PENDING_FAI'),
    [bootstrap.ordersList]
  );

  // Operations for selected QC PO
  const opsForQcPo = useMemo(() => {
    const po = bootstrap.ordersList.find((p) => p.poId === qcPoId);
    if (!po) return bootstrap.operations;
    const matched = bootstrap.operations.filter(
      (o) =>
        (po.spId && o.spId === po.spId) ||
        normalizeVn(o.productName).toLowerCase() === normalizeVn(po.productName).toLowerCase()
    );
    return matched.length > 0 ? matched : bootstrap.operations;
  }, [bootstrap.ordersList, bootstrap.operations, qcPoId]);

  const openNewQcModalForPo = (
    poId?: string,
    type: 'FAI' | 'IPQC' | 'OQC' | 'NG_REVIEW' = 'FAI'
  ) => {
    const chosenPoId = poId || bootstrap.ordersList[0]?.poId || '';
    setQcInspType(type);
    setQcPoId(chosenPoId);
    const poObj = bootstrap.ordersList.find((p) => p.poId === chosenPoId);
    const firstOp = poObj
      ? bootstrap.operations.find(
          (o) =>
            (poObj.spId && o.spId === poObj.spId) ||
            normalizeVn(o.productName).toLowerCase() ===
              normalizeVn(poObj.productName).toLowerCase()
        )
      : bootstrap.operations[0];
    setQcNcId(firstOp?.ncId || '');
    setQcMachineName(firstOp?.defaultMachine || bootstrap.machines[0]?.name || '');
    setQcResult('PASS');
    setQcDefectQty(0);
    setCreateQcOpen(true);
  };

  const handleSubmitQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcPoId) {
      toast.warning('Vui lòng chọn mã PO cần lập biên bản QC.');
      return;
    }
    setSubmittingQc(true);
    try {
      const enrichedDims = qcDims.map((d) => {
        const diff = Math.abs(Number(d.measured) - Number(d.nominal));
        const pass = diff <= Number(d.tolPlusMinus) + 1e-6;
        return {
          ...d,
          deviation: Number((Number(d.measured) - Number(d.nominal)).toFixed(4)),
          pass,
        };
      });

      await apiClient.post('/qc', {
        inspectionType: qcInspType,
        poId: qcPoId,
        ncId: qcNcId || null,
        machineName: qcMachineName,
        operatorId: qcOperatorId,
        sampleSize: qcSampleSize,
        defectQty: qcDefectQty,
        result: qcResult,
        measuredDims: enrichedDims,
        rootCause: qcRootCause,
        correctiveAction: qcCorrective,
      });

      toast.success(`Đã lưu biên bản ${qcInspType} cho lệnh ${qcPoId} (${qcResult}).`);
      setCreateQcOpen(false);
      setQcRootCause('');
      setQcCorrective('');
      await reloadQc();
      await reloadLogs();
      await onRefreshBootstrap();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu biên bản QC.');
    } finally {
      setSubmittingQc(false);
    }
  };

  const filteredQc = useMemo(() => {
    return qcList.filter((q) => {
      if (qcTypeFilter !== 'ALL' && q.inspectionType !== qcTypeFilter) return false;
      if (!qcSearch.trim()) return true;
      return matchesSearch(
        `${q.poId} ${q.productName || ''} ${q.opName || ''} ${q.inspectorName} ${q.machineName} ${q.result}`,
        qcSearch
      );
    });
  }, [qcList, qcTypeFilter, qcSearch]);

  const pagedQc = useMemo(() => {
    const start = (qcPage - 1) * qcPageSize;
    return filteredQc.slice(start, start + qcPageSize);
  }, [filteredQc, qcPage, qcPageSize]);

  return (
    <div className="space-y-4">
      {/* ==================== SUB-VIEW NAVIGATION BAR ==================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-industrial-border bg-industrial-surface p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubView('LOGS')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-extrabold transition-all ${
              subView === 'LOGS'
                ? 'border-sky-400 bg-sky-500/20 text-sky-200 shadow'
                : 'border-industrial-border bg-industrial-elevated text-slate-300 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-sky-400" />
            A. Nhật Ký Sản Lượng Realtime ({logs.filter((l) => !l.isVoided).length})
          </button>

          <button
            type="button"
            onClick={() => setSubView('QC')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-extrabold transition-all ${
              subView === 'QC'
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow'
                : 'border-industrial-border bg-industrial-elevated text-slate-300 hover:text-white'
            }`}
          >
            <Microscope className="h-4 w-4 text-emerald-400" />
            B. Kiểm Soát Chất Lượng 3 Tầng — FAI / IPQC / OQC ({qcList.length})
            {pendingFaiPos.length > 0 && (
              <Badge variant="warning">{pendingFaiPos.length} chờ FAI</Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubView('TRACE')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-extrabold transition-all ${
              subView === 'TRACE'
                ? 'border-purple-400 bg-purple-500/20 text-purple-200 shadow'
                : 'border-industrial-border bg-industrial-elevated text-slate-300 hover:text-white'
            }`}
          >
            <GitCommit className="h-4 w-4 text-purple-400" />
            C. Truy Vết Nguồn Gốc 100% Theo Mã PO
          </button>
        </div>

        {subView === 'LOGS' && (
          <Button
            variant="success"
            size="sm"
            disabled={exportingLogs}
            onClick={() => void handleExportLogsExcel()}
          >
            <Download className="h-4 w-4" />
            📥 Xuất Excel Báo Cáo Ngày (17 cột)
          </Button>
        )}

        {subView === 'QC' && (
          <Button variant="primary" size="sm" onClick={() => openNewQcModalForPo()}>
            <Plus className="h-4 w-4" />
            Tạo Biên Bản Kiểm Tra QC Mới
          </Button>
        )}
      </div>

      {/* ==================== SUB-VIEW A: PRODUCTION LOGS ==================== */}
      {subView === 'LOGS' && (
        <Card noPadding>
          <div className="space-y-3 border-b border-industrial-border bg-slate-950/50 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['ALL', 'Tất cả phiếu hợp lệ'],
                  ['HAS_NG', '⚠️ Có hàng NG / Rework'],
                  ['PENDING_QC', '⏳ Chờ QC hậu kiểm / NG Hold'],
                  ['HANDOVER', '📝 Có ghi chú bàn giao ca'],
                  ['VOIDED', '🚫 Phiếu đã hủy (Voided)'],
                ] as Array<[LogIssueFilter, string]>
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setLogIssueFilter(k);
                    setLogPage(1);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                    logIssueFilter === k
                      ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                      : 'border-industrial-border bg-industrial-elevated text-slate-300'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                    setLogPage(1);
                  }}
                  placeholder="Tìm mã phiếu, PO, Sản phẩm, Nguyên công, Công nhân..."
                  className="h-9 w-full rounded-lg border border-industrial-border bg-industrial-elevated pl-9 pr-3 text-xs text-slate-100"
                />
              </div>

              <input
                type="date"
                value={logDateFilter}
                onChange={(e) => {
                  setLogDateFilter(e.target.value);
                  setLogPage(1);
                }}
                className="h-9 rounded-lg border border-industrial-border bg-industrial-elevated px-2.5 text-xs text-slate-100"
              />

              <select
                value={logWorkerFilter}
                onChange={(e) => {
                  setLogWorkerFilter(e.target.value);
                  setLogPage(1);
                }}
                className="h-9 rounded-lg border border-industrial-border bg-industrial-elevated px-2.5 text-xs text-slate-200"
              >
                <option value="ALL">Tất cả Công nhân</option>
                {bootstrap.workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.id})
                  </option>
                ))}
              </select>

              <div className="flex gap-1.5">
                <select
                  value={logMachineFilter}
                  onChange={(e) => {
                    setLogMachineFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className="h-9 flex-1 rounded-lg border border-industrial-border bg-industrial-elevated px-2 text-xs text-slate-200"
                >
                  <option value="ALL">Tất cả Máy</option>
                  {bootstrap.machines.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  value={logShiftFilter}
                  onChange={(e) => {
                    setLogShiftFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className="h-9 w-24 rounded-lg border border-industrial-border bg-industrial-elevated px-2 text-xs text-slate-200"
                >
                  <option value="ALL">Mọi ca</option>
                  <option value="Ca 1">Ca 1</option>
                  <option value="Ca 2">Ca 2</option>
                  <option value="Ca 3">Ca 3</option>
                  <option value="Hành chính">HC</option>
                </select>
              </div>
            </div>
          </div>

          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] font-bold uppercase tracking-wider text-slate-400 shadow">
                <tr className="border-b border-industrial-border">
                  <th className="px-3 py-2.5">Thời Gian / Ca</th>
                  <th className="px-3 py-2.5">Công Nhân &amp; Máy</th>
                  <th className="px-3 py-2.5">PO / Sản Phẩm / Nguyên Công</th>
                  <th className="px-3 py-2.5 text-center">OK / RW / NG</th>
                  <th className="px-3 py-2.5 text-center">Dừng / Dao</th>
                  <th className="px-3 py-2.5 text-center">QC &amp; KPI</th>
                  <th className="px-3 py-2.5 text-right">Lương Ca</th>
                  <th className="px-3 py-2.5">Ảnh &amp; Bàn Giao Ca</th>
                  <th className="px-3 py-2.5 text-right">Sửa / Hủy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-border/60">
                {pagedLogs.map((l) => (
                  <tr
                    key={l.id}
                    className={`hover:bg-slate-800/40 ${
                      l.isVoided ? 'bg-red-950/20 opacity-65 line-through' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-mono-num font-bold text-slate-100">
                        {formatDateVn(l.workDate)} • {l.timeStr}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {l.shiftType.split('(')[0].trim()} ({l.startTime}–{l.endTime})
                        {l.isLightsOut === 1 && (
                          <span className="ml-1 text-purple-300">🌙 Lights-out</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-100">{l.workerName}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px]">
                        <Badge variant="neutral">{l.machineName}</Badge>
                        {l.machineMode === 'SECOND' && (
                          <Badge variant="info">Ghép máy 0.33</Badge>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTracePoInput(l.poId);
                            setSubView('TRACE');
                            void fetchTraceability(l.poId);
                          }}
                          className="font-mono-num font-bold text-amber-300 hover:underline"
                          title="Bấm truy vết PO này"
                        >
                          {l.poId}
                        </button>
                        <span className="text-slate-400">• {l.customer}</span>
                      </div>
                      <div className="mt-0.5 font-semibold text-sky-300">{l.productName}</div>
                      <div className="text-[11px] text-slate-400">
                        [{l.ncId}] {l.opName} {l.isFinalOp === 1 ? '🏁(End)' : ''}
                      </div>
                    </td>

                    <td className="font-mono-num px-3 py-2.5 text-center">
                      <span className="font-extrabold text-emerald-400">{l.okQty}</span>
                      {' / '}
                      <span className="font-semibold text-amber-300">{l.reworkQty}</span>
                      {' / '}
                      <span
                        className={
                          l.scrapQty > 0 ? 'font-extrabold text-red-400' : 'text-slate-500'
                        }
                      >
                        {l.scrapQty}
                      </span>
                    </td>

                    <td className="font-mono-num px-3 py-2.5 text-center text-[11px]">
                      {l.stopMinutes > 0 ? (
                        <div className="font-bold text-amber-300">{l.stopMinutes}p dừng</div>
                      ) : (
                        <div className="text-slate-500">0p dừng</div>
                      )}
                      {l.toolCode && (
                        <div className="text-slate-400">
                          {l.toolCode} ({l.edgesUsed} cạnh)
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <Badge
                        variant={
                          l.qcStatus === 'PASSED'
                            ? 'success'
                            : l.qcStatus === 'NG_HOLD'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {l.qcStatus}
                      </Badge>
                      <div className="mt-1 text-[11px] text-slate-400">{l.kpiStatus}</div>
                    </td>

                    <td className="font-mono-num px-3 py-2.5 text-right font-bold text-emerald-300">
                      {l.income > 0 ? formatVnd(l.income) : '—'}
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {l.photoUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoLog(l)}
                            className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300"
                          >
                            <Camera className="h-3 w-3" /> Ảnh SP
                          </button>
                        )}
                        {l.handoverNote ? (
                          <span className="max-w-[180px] truncate text-[11px] font-medium text-amber-200">
                            📝 {l.handoverNote}
                          </span>
                        ) : (
                          !l.photoUrl && <span className="text-slate-600">—</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      {canEditLogs ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditLogModal(l)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Sửa/Hủy
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Chỉ xem</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            totalItems={filteredLogs.length}
            page={logPage}
            pageSize={logPageSize}
            onPageChange={setLogPage}
            onPageSizeChange={(sz) => {
              setLogPageSize(sz);
              setLogPage(1);
            }}
          />
        </Card>
      )}

      {/* ==================== SUB-VIEW B: 3-TIER QA/QC & FAI ==================== */}
      {subView === 'QC' && (
        <div className="space-y-4">
          {pendingFaiPos.length > 0 && (
            <Card className="border-amber-500/45 bg-amber-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  <ShieldAlert className="h-4 w-4" />
                  <span>
                    Danh Sách Đơn Hàng Lô Lớn (SL ≥ 5) Đang Chờ Duyệt Mẫu Đầu FAI (
                    {pendingFaiPos.length} PO)
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Bấm 1-click để mở bảng đo dung sai ±0.01mm &amp; cấp phép chạy loạt
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingFaiPos.slice(0, 12).map((po) => (
                  <button
                    key={po.poId}
                    type="button"
                    onClick={() => openNewQcModalForPo(po.poId, 'FAI')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-slate-950 px-3 py-1.5 text-xs font-bold text-amber-200 hover:border-amber-400 hover:bg-amber-500/15"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{po.poId}</span>
                    <span className="text-slate-400">({po.qtyPo} SP)</span>
                    <span className="text-sky-300">→ Duyệt FAI</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card noPadding>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-industrial-border bg-slate-950/50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['ALL', 'FAI', 'IPQC', 'OQC', 'NG_REVIEW'] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => {
                      setQcTypeFilter(tp);
                      setQcPage(1);
                    }}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                      qcTypeFilter === tp
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-industrial-border bg-industrial-elevated text-slate-300'
                    }`}
                  >
                    {tp === 'ALL'
                      ? `Tất cả (${qcList.length})`
                      : tp === 'FAI'
                        ? '🟢 Tầng 1: FAI (Con đầu)'
                        : tp === 'IPQC'
                          ? '🔵 Tầng 2: IPQC (Trong ca)'
                          : tp === 'OQC'
                            ? '🟣 Tầng 3: OQC (Xuất xưởng)'
                            : '🔴 NG_REVIEW (Xử lý hàng lỗi)'}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[250px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={qcSearch}
                  onChange={(e) => {
                    setQcSearch(e.target.value);
                    setQcPage(1);
                  }}
                  placeholder="Tìm PO, Sản phẩm, Người duyệt QC..."
                  className="h-9 w-full rounded-lg border border-industrial-border bg-industrial-elevated pl-9 pr-3 text-xs text-slate-100"
                />
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <tr className="border-b border-industrial-border">
                    <th className="px-3.5 py-2.5">Loại &amp; Thời Gian</th>
                    <th className="px-3 py-2.5">Mã PO / Sản Phẩm / Công Đoạn</th>
                    <th className="px-3 py-2.5">Máy &amp; Người Kiểm Tra</th>
                    <th className="px-3 py-2.5 text-center">Mẫu / Lỗi</th>
                    <th className="px-3 py-2.5">Bảng Đo Dung Sai Thực Tế (±0.01mm)</th>
                    <th className="px-3 py-2.5 text-center">Kết Quả</th>
                    <th className="px-3.5 py-2.5">Nguyên Nhân &amp; Đối Sách</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-border/60">
                  {pagedQc.map((q) => {
                    const dims = normalizeQcMeasuredDims(q.measuredDimsJson);
                    const resVariant =
                      q.result === 'PASS'
                        ? 'success'
                        : q.result === 'CONCESSION'
                          ? 'info'
                          : q.result === 'REWORK'
                            ? 'warning'
                            : 'danger';

                    return (
                      <tr key={q.id} className="hover:bg-slate-800/40">
                        <td className="px-3.5 py-2.5">
                          <Badge
                            variant={
                              q.inspectionType === 'FAI'
                                ? 'success'
                                : q.inspectionType === 'NG_REVIEW'
                                  ? 'danger'
                                  : 'info'
                            }
                          >
                            {q.inspectionType}
                          </Badge>
                          <div className="font-mono-num mt-1 text-[11px] text-slate-400">
                            {q.createdAt}
                          </div>
                        </td>

                        <td className="px-3 py-2.5">
                          <div className="font-mono-num font-bold text-amber-300">{q.poId}</div>
                          <div className="font-semibold text-sky-300">{q.productName || '—'}</div>
                          {q.opName && (
                            <div className="text-[11px] text-slate-400">
                              [{q.ncId}] {q.opName}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-200">{q.machineName || '—'}</div>
                          <div className="text-[11px] text-slate-400">
                            QC: <strong className="text-emerald-300">{q.inspectorName}</strong>
                          </div>
                        </td>

                        <td className="font-mono-num px-3 py-2.5 text-center">
                          <span className="font-bold text-slate-100">{q.sampleSize}</span> mẫu /{' '}
                          <span
                            className={
                              q.defectQty > 0 ? 'font-bold text-red-400' : 'text-slate-500'
                            }
                          >
                            {q.defectQty} lỗi
                          </span>
                        </td>

                        <td className="px-3 py-2.5">
                          {dims.length === 0 ? (
                            <span className="text-slate-500">Kiểm ngoại quan / Calip đạt</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {dims.map((d, idx) => (
                                <Badge key={idx} variant={d.ok ? 'success' : 'danger'}>
                                  {d.label}
                                  {d.specText ? `: ${d.specText}` : ''} →{' '}
                                  <strong>{d.measuredText}</strong>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-center">
                          <Badge variant={resVariant}>{q.result}</Badge>
                        </td>

                        <td className="px-3.5 py-2.5 text-[11px]">
                          {q.rootCause ? (
                            <div>
                              <span className="text-red-300">NN: {q.rootCause}</span>
                              {q.correctiveAction && (
                                <div className="text-emerald-300">ĐS: {q.correctiveAction}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">Đạt chuẩn dung sai bản vẽ</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationBar
              totalItems={filteredQc.length}
              page={qcPage}
              pageSize={qcPageSize}
              onPageChange={setQcPage}
              onPageSizeChange={(sz) => {
                setQcPageSize(sz);
                setQcPage(1);
              }}
            />
          </Card>
        </div>
      )}

      {/* ==================== SUB-VIEW C: 100% PO GENEALOGY TRACEABILITY ==================== */}
      {subView === 'TRACE' && (
        <div className="space-y-4">
          <Card>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void fetchTraceability(tracePoInput);
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="min-w-[260px] flex-1">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nhập hoặc Chọn Mã Đơn Hàng PO Cần Truy Vết 100% Nguồn Gốc
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    list="gcck-trace-pos"
                    value={tracePoInput}
                    onChange={(e) => setTracePoInput(e.target.value)}
                    placeholder="VD: PO485-01..."
                    className="font-mono-num h-10 flex-1 rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-sm font-bold text-amber-300 focus:border-purple-400 focus:outline-none"
                  />
                  <datalist id="gcck-trace-pos">
                    {bootstrap.ordersList.map((po) => (
                      <option
                        key={po.poId}
                        value={po.poId}
                        label={`${po.customer} — ${po.productName}`}
                      />
                    ))}
                  </datalist>
                  <Button type="submit" variant="primary" disabled={loadingTrace}>
                    <Search className="h-4 w-4" />
                    {loadingTrace ? 'Đang truy vết...' : 'Truy Xuất Hồ Sơ Lô'}
                  </Button>
                </div>
              </div>

              {traceData && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigateTo(`/print/traveler/${encodeURIComponent(traceData.po.poId)}`)
                  }
                >
                  <Printer className="h-4 w-4 text-sky-300" />
                  🖨️ In Phiếu Công Nghệ QR
                </Button>
              )}
            </form>

            {/* Quick select recent active POs */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400">Chọn nhanh PO tiêu biểu:</span>
              {bootstrap.ordersList.slice(0, 8).map((po) => (
                <button
                  key={po.poId}
                  type="button"
                  onClick={() => {
                    setTracePoInput(po.poId);
                    void fetchTraceability(po.poId);
                  }}
                  className={`font-mono-num rounded-md border px-2 py-0.5 font-semibold ${
                    traceData?.po.poId === po.poId
                      ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                      : 'border-industrial-border bg-slate-900 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {po.poId}
                </button>
              ))}
            </div>
          </Card>

          {traceError && (
            <Card className="border-red-500/50 bg-red-950/30 text-sm text-red-200">
              {traceError}
            </Card>
          )}

          {traceData && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Stage 1 & 2 & 4 Left Column */}
              <div className="space-y-4">
                <Card className="border-sky-500/35">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
                    1. Lô Phôi Đầu Vào &amp; Nhà Cung Cấp
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mã Lệnh SX / PO:</span>
                      <span className="font-mono-num font-extrabold text-amber-300">
                        {traceData.po.poId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Khách hàng:</span>
                      <span className="font-bold text-slate-100">{traceData.po.customer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sản phẩm:</span>
                      <span className="font-bold text-sky-300">{traceData.po.productName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mã Lô Phôi (Heat Lot):</span>
                      <Badge variant="info">{traceData.materialInfo.materialLot}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nhà cung cấp phôi:</span>
                      <span className="font-semibold text-slate-200">
                        {traceData.materialInfo.supplierName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ngày đúc / Nhập phôi:</span>
                      <span className="font-mono-num text-slate-200">
                        {formatDateVn(traceData.materialInfo.castDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mác vật liệu:</span>
                      <span className="font-semibold text-emerald-300">
                        {traceData.materialInfo.matName}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card className="border-emerald-500/35">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                      2. Hồ Sơ Duyệt FAI &amp; QC ({traceData.qcRecords.length})
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openNewQcModalForPo(traceData.po.poId, 'FAI')}
                    >
                      + Lập QC
                    </Button>
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    {traceData.qcRecords.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-industrial-border p-3 text-slate-400">
                        Chưa có biên bản kiểm tra FAI/IPQC cho PO này.
                      </div>
                    ) : (
                      traceData.qcRecords.map((qc) => (
                        <div
                          key={qc.id}
                          className="rounded-lg border border-industrial-border bg-slate-950 p-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="success">{qc.inspectionType}</Badge>
                            <Badge variant={qc.result === 'PASS' ? 'success' : 'warning'}>
                              {qc.result}
                            </Badge>
                          </div>
                          <div className="mt-1 font-semibold text-slate-200">
                            Người duyệt: {qc.inspectorName} ({qc.machineName || 'QC Room'})
                          </div>
                          <div className="font-mono-num text-[11px] text-slate-400">
                            {qc.createdAt} • Mẫu: {qc.sampleSize}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="border-amber-500/35">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                    4. Lịch Sử Xuất Kho Giao Hàng ({traceData.deliveries.length})
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-slate-950 p-2 text-center text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400">SL Đặt</div>
                      <div className="font-mono-num font-bold">{traceData.po.qtyPo}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Đã Giao</div>
                      <div className="font-mono-num font-bold text-emerald-400">
                        {traceData.po.deliveredQty}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Còn Lại</div>
                      <div className="font-mono-num font-bold text-amber-300">
                        {traceData.po.remainQty}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    {traceData.deliveries.length === 0 ? (
                      <div className="text-slate-500">Chưa xuất giao đợt nào.</div>
                    ) : (
                      traceData.deliveries.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between rounded-lg border border-industrial-border bg-slate-950 px-2.5 py-2"
                        >
                          <div>
                            <div className="font-bold text-emerald-300">
                              <Truck className="mr-1 inline h-3.5 w-3.5" />
                              Giao +{d.qtyDeliver} SP
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Bởi {d.deliveredBy} • {d.note || 'Phiếu xuất chuẩn'}
                            </div>
                          </div>
                          <span className="font-mono-num text-[11px] text-slate-400">
                            {d.deliveredAt}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              {/* Stage 3 Right 2 Columns: Full Step-by-Step Operations Genealogy */}
              <div className="lg:col-span-2">
                <Card>
                  <div className="flex items-center justify-between border-b border-industrial-border pb-3">
                    <div>
                      <div className="text-xs font-extrabold uppercase tracking-wider text-purple-300">
                        3. Hành Trình Gia Công Từng Nguyên Công (Máy — Thợ — Giờ — Dao — Ảnh)
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        Theo dõi xuyên suốt từ Bước 1 tới Công đoạn Cuối (End)
                      </div>
                    </div>
                    <Badge variant="purple">
                      {traceData.operationsTimeline.length} bước công nghệ
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-4">
                    {traceData.operationsTimeline.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-industrial-border p-6 text-center text-xs text-slate-400">
                        Sản phẩm của PO này chưa khai báo danh sách nguyên công chuẩn.
                      </div>
                    ) : (
                      traceData.operationsTimeline.map((step) => (
                        <div
                          key={step.ncId}
                          className="rounded-xl border border-industrial-border bg-slate-950/70 p-3.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={step.isFinalOp === 1 ? 'success' : 'info'}>
                                {step.isFinalOp === 1
                                  ? `🏁 Bước Cuối (${step.stepOrder})`
                                  : `Bước ${step.stepOrder}`}
                              </Badge>
                              <span className="font-mono-num text-xs font-bold text-sky-400">
                                {step.ncId}
                              </span>
                              <span className="text-sm font-bold text-slate-100">
                                {step.opName}
                              </span>
                            </div>

                            <div className="font-mono-num flex items-center gap-2 text-xs">
                              <Badge variant="success">OK: {step.totalOk}</Badge>
                              {step.totalRework > 0 && (
                                <Badge variant="warning">RW: {step.totalRework}</Badge>
                              )}
                              {step.totalScrap > 0 && (
                                <Badge variant="danger">NG: {step.totalScrap}</Badge>
                              )}
                            </div>
                          </div>

                          {step.logs.length === 0 ? (
                            <div className="mt-2 text-xs text-slate-500">
                              Chưa có phiếu ghi nhận sản lượng ở bước này.
                            </div>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {step.logs.map((lg) => (
                                <div
                                  key={lg.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-industrial-border/80 bg-industrial-surface px-3 py-2 text-xs"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-100">
                                      👷 {lg.workerName} • 🖥️{' '}
                                      <span className="text-sky-300">{lg.machineName}</span>
                                    </div>
                                    <div className="font-mono-num mt-0.5 text-[11px] text-slate-400">
                                      {formatDateVn(lg.workDate)} ({lg.startTime}–{lg.endTime}) •
                                      Dao: {lg.toolCode || 'Chuẩn'} ({lg.edgesUsed} cạnh)
                                    </div>
                                    {lg.handoverNote && (
                                      <div className="mt-0.5 text-[11px] text-amber-300">
                                        📝 Bàn giao: {lg.handoverNote}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {lg.photoUrl && (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewPhotoLog(lg)}
                                        className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-300"
                                      >
                                        📷 Xem ảnh
                                      </button>
                                    )}
                                    <div className="font-mono-num text-right">
                                      <div className="font-bold text-emerald-400">
                                        +{lg.okQty} OK
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {lg.recordUid}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL: EDIT / VOID PRODUCTION LOG ==================== */}
      <Modal
        open={Boolean(editLog)}
        onClose={() => setEditLog(null)}
        title={`✏️ Hiệu Chỉnh / Hủy Phiếu Sản Lượng: ${editLog?.recordUid || ''}`}
        subtitle={
          editLog
            ? `${editLog.workerName} • ${editLog.machineName} • [${editLog.poId}] ${editLog.opName}`
            : ''
        }
        maxWidthClass="max-w-lg"
      >
        <form noValidate onSubmit={handleSaveLogEdit} className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-bold uppercase text-emerald-400">SL Đạt (OK)</label>
              <input
                type="number"
                min={0}
                value={editOkQty}
                onChange={(e) => setEditOkQty(Math.max(0, Number(e.target.value) || 0))}
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-base font-bold text-emerald-300"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-amber-400">SL Rework</label>
              <input
                type="number"
                min={0}
                value={editReworkQty}
                onChange={(e) => setEditReworkQty(Math.max(0, Number(e.target.value) || 0))}
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-base font-bold text-amber-300"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-red-400">SL Hủy (NG)</label>
              <input
                type="number"
                min={0}
                value={editScrapQty}
                onChange={(e) => setEditScrapQty(Math.max(0, Number(e.target.value) || 0))}
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-base font-bold text-red-300"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold uppercase text-slate-400">
              Trạng Thái Phê Duyệt QC
            </label>
            <select
              value={editQcStatus}
              onChange={(e) =>
                setEditQcStatus(e.target.value as 'PASSED' | 'PENDING_QC' | 'NG_HOLD')
              }
              className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-semibold text-slate-100"
            >
              <option value="PASSED">PASSED — Đạt chất lượng</option>
              <option value="PENDING_QC">PENDING_QC — Đang chờ hậu kiểm</option>
              <option value="NG_HOLD">NG_HOLD — Tạm giữ khoang đỏ chờ xử lý</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/25 p-3">
            <input
              type="checkbox"
              checked={editIsVoided}
              onChange={(e) => setEditIsVoided(e.target.checked)}
              className="h-4 w-4 rounded border-red-400 bg-slate-950 text-red-500"
            />
            <div>
              <div className="font-bold text-red-300">
                🚫 Đánh dấu Hủy phiếu báo cáo nhầm (Void Ticket)
              </div>
              <div className="text-[11px] text-slate-400">
                Phiếu bị hủy sẽ không tính vào lương tháng, giá thành thực tế và tự động hoàn trừ SL
                thành phẩm trên PO nếu là công đoạn cuối.
              </div>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditLog(null)}>
              Đóng
            </Button>
            <Button
              type="submit"
              variant={editIsVoided ? 'danger' : 'primary'}
              disabled={savingLogEdit}
            >
              {editIsVoided ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {savingLogEdit
                ? 'Đang cập nhật...'
                : editIsVoided
                  ? 'Xác Nhận Hủy Phiếu'
                  : 'Lưu Hiệu Chỉnh'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: CREATE 3-TIER QC INSPECTION ==================== */}
      <Modal
        open={createQcOpen}
        onClose={() => setCreateQcOpen(false)}
        title="🔬 Lập Biên Bản Kiểm Soát Chất Lượng 3 Tầng (FAI / IPQC / OQC)"
        subtitle="Ghi nhận bảng đo kích thước dung sai thực tế ±0.01mm và phê duyệt chạy loạt"
        maxWidthClass="max-w-2xl"
      >
        <form noValidate onSubmit={handleSubmitQc} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Tầng Kiểm Tra (*)
              </label>
              <select
                value={qcInspType}
                onChange={(e) => setQcInspType(e.target.value as any)}
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-2.5 font-bold text-emerald-300"
              >
                <option value="FAI">FAI — Duyệt mẫu đầu tiên</option>
                <option value="IPQC">IPQC — Tuần kiểm trong ca</option>
                <option value="OQC">OQC — Kiểm cuối xuất xưởng</option>
                <option value="NG_REVIEW">NG_REVIEW — Xử lý phế phẩm</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Mã Lệnh PO (*)
              </label>
              <select
                value={qcPoId}
                onChange={(e) => setQcPoId(e.target.value)}
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-2.5 font-bold text-amber-300"
              >
                {bootstrap.ordersList.map((po) => (
                  <option key={po.poId} value={po.poId}>
                    {po.poId} — {po.productName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">Nguyên Công</label>
              <select
                value={qcNcId}
                onChange={(e) => setQcNcId(e.target.value)}
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-2.5 text-slate-100"
              >
                <option value="">-- Chung toàn PO --</option>
                {opsForQcPo.map((op) => (
                  <option key={op.ncId} value={op.ncId}>
                    {op.ncId} — {op.opName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">Máy gia công</label>
              <select
                value={qcMachineName}
                onChange={(e) => setQcMachineName(e.target.value)}
                className="h-9 w-full rounded-lg border border-industrial-border bg-industrial-elevated px-2 text-slate-100"
              >
                {bootstrap.machines.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">Thợ đứng máy</label>
              <select
                value={qcOperatorId}
                onChange={(e) => setQcOperatorId(e.target.value)}
                className="h-9 w-full rounded-lg border border-industrial-border bg-industrial-elevated px-2 text-slate-100"
              >
                {bootstrap.workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">Cỡ mẫu đo</label>
              <input
                type="number"
                min={1}
                value={qcSampleSize}
                onChange={(e) => setQcSampleSize(Math.max(1, Number(e.target.value) || 1))}
                className="font-mono-num h-9 w-full rounded-lg border border-industrial-border bg-industrial-elevated px-2.5 font-bold text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">SL Lỗi phát hiện</label>
              <input
                type="number"
                min={0}
                value={qcDefectQty}
                onChange={(e) => setQcDefectQty(Math.max(0, Number(e.target.value) || 0))}
                className="font-mono-num h-9 w-full rounded-lg border border-industrial-border bg-industrial-elevated px-2.5 font-bold text-red-300"
              />
            </div>
          </div>

          {/* Precision Tolerance Table ±0.01mm */}
          <div className="rounded-xl border border-sky-500/30 bg-slate-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold uppercase text-sky-300">
                📏 Bảng Đo Kích Thước Dung Sai Thực Tế (Panme / Đồng Hồ So ±0.01mm)
              </span>
              <button
                type="button"
                onClick={() =>
                  setQcDims((prev) => [
                    ...prev,
                    { feature: `Kích thước KT${prev.length + 1}`, nominal: 50, tolPlusMinus: 0.01, measured: 50.0 },
                  ])
                }
                className="rounded border border-sky-400/50 bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-300"
              >
                + Thêm dòng đo
              </button>
            </div>

            <div className="space-y-1.5">
              {qcDims.map((dim, idx) => {
                const diff = Math.abs(Number(dim.measured) - Number(dim.nominal));
                const isOk = diff <= Number(dim.tolPlusMinus) + 1e-6;
                return (
                  <div key={idx} className="grid grid-cols-12 items-center gap-1.5">
                    <input
                      type="text"
                      value={dim.feature}
                      onChange={(e) =>
                        setQcDims((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, feature: e.target.value } : r))
                        )
                      }
                      className="col-span-5 h-8 rounded border border-industrial-border bg-industrial-elevated px-2 text-xs text-slate-100"
                      placeholder="Tên kích thước"
                    />
                    <input
                      type="number"
                      step="0.001"
                      value={dim.nominal}
                      onChange={(e) =>
                        setQcDims((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, nominal: Number(e.target.value) } : r
                          )
                        )
                      }
                      className="font-mono-num col-span-2 h-8 rounded border border-industrial-border bg-industrial-elevated px-2 text-right text-xs text-slate-100"
                      title="Danh nghĩa (mm)"
                    />
                    <input
                      type="number"
                      step="0.005"
                      value={dim.tolPlusMinus}
                      onChange={(e) =>
                        setQcDims((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, tolPlusMinus: Number(e.target.value) } : r
                          )
                        )
                      }
                      className="font-mono-num col-span-2 h-8 rounded border border-industrial-border bg-industrial-elevated px-2 text-right text-xs text-amber-300"
                      title="Dung sai ± (mm)"
                    />
                    <input
                      type="number"
                      step="0.001"
                      value={dim.measured}
                      onChange={(e) =>
                        setQcDims((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, measured: Number(e.target.value) } : r
                          )
                        )
                      }
                      className="font-mono-num col-span-2 h-8 rounded border border-sky-500/40 bg-slate-900 px-2 text-right text-xs font-bold text-sky-300"
                      title="Thực đo (mm)"
                    />
                    <div className="col-span-1 text-center">
                      <Badge variant={isOk ? 'success' : 'danger'}>{isOk ? 'OK' : 'NG'}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Kết Luận Phê Duyệt (*)
              </label>
              <select
                value={qcResult}
                onChange={(e) => setQcResult(e.target.value as any)}
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-2.5 font-bold text-slate-100"
              >
                <option value="PASS">✅ PASS — Đạt chuẩn cho chạy loạt</option>
                <option value="CONCESSION">🔵 CONCESSION — Nhân nhượng kỹ thuật</option>
                <option value="REWORK">🟡 REWORK — Yêu cầu sửa lại</option>
                <option value="SCRAP">🔴 SCRAP — Loại bỏ phế phẩm</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Nguyên Nhân (nếu lỗi)
              </label>
              <input
                type="text"
                value={qcRootCause}
                onChange={(e) => setQcRootCause(e.target.value)}
                placeholder="Mòn mảnh dao tinh, lệch gốc G54..."
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Đối Sách Khắc Phục
              </label>
              <input
                type="text"
                value={qcCorrective}
                onChange={(e) => setQcCorrective(e.target.value)}
                placeholder="Bù dao -0.015mm, thay chíp mới..."
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateQcOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="success" disabled={submittingQc}>
              <ShieldCheck className="h-4 w-4" />
              {submittingQc ? 'Đang lưu biên bản...' : 'Lưu Biên Bản Kiểm Tra QC'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: PHOTO EVIDENCE PREVIEW ==================== */}
      <Modal
        open={Boolean(previewPhotoLog)}
        onClose={() => setPreviewPhotoLog(null)}
        title={`📷 Ảnh Minh Chứng Sản Lượng: ${previewPhotoLog?.recordUid || ''}`}
        subtitle={
          previewPhotoLog
            ? `${previewPhotoLog.workerName} • ${previewPhotoLog.productName} (${previewPhotoLog.opName})`
            : ''
        }
        maxWidthClass="max-w-lg"
      >
        {previewPhotoLog && (
          <div className="space-y-3 text-xs">
            <div className="overflow-hidden rounded-xl border border-industrial-border bg-slate-950">
              <img
                src={previewPhotoLog.photoUrl}
                alt={previewPhotoLog.productName}
                className="max-h-[420px] w-full object-contain"
              />
            </div>
            {previewPhotoLog.handoverNote && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 text-amber-200">
                📝 Ghi chú bàn giao: {previewPhotoLog.handoverNote}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
