import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Factory,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  FolderOpen,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import type { DailyPlanRow, WeeklyReportData } from '@shared/types';
import { apiClient } from '@client/lib/apiClient';
import { formatDateVn, formatNumber, formatVnd } from '@client/lib/formatters';
import { navigateTo } from '@client/lib/navigation';
import {
  Badge,
  Button,
  Card,
  Modal,
  useToast,
} from '@client/components/ui/IndustrialPrimitives';
import { DEFAULT_DRIVE_FOLDER_URL } from '@shared/driveHelper';
import type { AdminTabCommonProps } from '../types';

export function DailyWeeklyScheduleTab({
  bootstrap,
  onRefreshBootstrap,
}: AdminTabCommonProps) {
  const toast = useToast();
  const [subTab, setSubTab] = useState<'daily' | 'weekly'>('daily');

  // ==================== TAB 1: DAILY SCHEDULE STATE ====================
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-21');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [dailyRows, setDailyRows] = useState<DailyPlanRow[]>([]);
  const [loadingDaily, setLoadingDaily] = useState<boolean>(false);
  const [savingDaily, setSavingDaily] = useState<boolean>(false);

  // Load Daily Rows for selectedDate
  const loadDailyRows = async (date: string) => {
    setLoadingDaily(true);
    try {
      const res = await apiClient.get<{ success: boolean; rows: DailyPlanRow[] }>(
        `/schedules/daily?date=${encodeURIComponent(date)}`
      );
      if (res.rows && res.rows.length > 0) {
        setDailyRows(res.rows);
      } else {
        // Generate blank 3-rows template for the 13 active workers if date is empty
        const activeWorkers = bootstrap.workers.filter((w) => w.isActive);
        const blankRows: DailyPlanRow[] = [];
        let stt = 1;
        for (const w of activeWorkers) {
          for (let i = 0; i < 3; i++) {
            blankRows.push({
              workDate: date,
              shiftType: 'Ca 2',
              stt: stt++,
              workerName: w.name,
              customer: '',
              productName: '',
              opName: '',
              plannedQty: 0,
              machineName: '',
              note: '',
              actualQty: 0,
              status: 'PLANNED',
            });
          }
        }
        setDailyRows(blankRows);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải kế hoạch ngày.');
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    void loadDailyRows(selectedDate);
  }, [selectedDate]);

  // Distinct Customers, Products, Machines for Cascade Selectors
  const customerList = useMemo(() => {
    const set = new Set<string>();
    for (const p of bootstrap.products) {
      if (p.customer) set.add(p.customer);
    }
    for (const po of bootstrap.ordersList) {
      if (po.customer) set.add(po.customer);
    }
    return Array.from(set).sort();
  }, [bootstrap.products, bootstrap.ordersList]);

  const machineList = useMemo(() => {
    return bootstrap.machines.map((m) => m.name);
  }, [bootstrap.machines]);

  // Handle row field change
  const handleRowChange = (index: number, field: keyof DailyPlanRow, value: any) => {
    setDailyRows((prev) => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: value };

      // Cascade logic: if customer changes, reset product and op
      if (field === 'customer') {
        cur.productName = '';
        cur.opName = '';
        cur.spId = '';
        cur.ncId = '';
      }
      // If product changes, auto fill spId and customer if empty, and reset op
      if (field === 'productName') {
        const prod = bootstrap.products.find((p) => p.productName === value);
        if (prod) {
          cur.spId = prod.spId;
          if (!cur.customer) cur.customer = prod.customer;
        }
        cur.opName = '';
        cur.ncId = '';
      }
      // If opName changes, auto fill ncId and default machine
      if (field === 'opName') {
        const op = bootstrap.operations.find(
          (o) => o.opName === value && (!cur.spId || o.spId === cur.spId)
        );
        if (op) {
          cur.ncId = op.ncId;
          if (!cur.machineName && op.defaultMachine) {
            cur.machineName = op.defaultMachine;
          }
        }
      }

      updated[index] = cur;
      return updated;
    });
  };

  // Add extra row for a worker
  const handleAddWorkerRow = (workerName: string, shiftType: string) => {
    setDailyRows((prev) => [
      ...prev,
      {
        workDate: selectedDate,
        shiftType: shiftType || 'Ca 2',
        stt: prev.length + 1,
        workerName,
        customer: '',
        productName: '',
        opName: '',
        plannedQty: 0,
        machineName: '',
        note: '',
        actualQty: 0,
        status: 'PLANNED',
      },
    ]);
  };

  // Delete row
  const handleDeleteRow = (index: number) => {
    setDailyRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Save Daily Schedule
  const handleSaveDailySchedule = async () => {
    setSavingDaily(true);
    try {
      await apiClient.post('/schedules/daily', {
        workDate: selectedDate,
        rows: dailyRows,
      });
      toast.success(`Đã lưu thành công ${dailyRows.length} dòng kế hoạch ngày ${selectedDate}!`);
      await onRefreshBootstrap();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu kế hoạch ngày.');
    } finally {
      setSavingDaily(false);
    }
  };

  // Filtered rows by shift
  const filteredDailyRows = useMemo(() => {
    if (selectedShift === 'ALL') return dailyRows;
    return dailyRows.filter((r) => r.shiftType === selectedShift);
  }, [dailyRows, selectedShift]);

  // Group filtered rows by worker
  const rowsByWorker = useMemo(() => {
    const map = new Map<string, Array<{ row: DailyPlanRow; originalIdx: number }>>();
    dailyRows.forEach((row, originalIdx) => {
      if (selectedShift !== 'ALL' && row.shiftType !== selectedShift) return;
      const list = map.get(row.workerName) || [];
      list.push({ row, originalIdx });
      map.set(row.workerName, list);
    });
    return Array.from(map.entries());
  }, [dailyRows, selectedShift]);

  // ==================== TAB 2: WEEKLY REPORT STATE ====================
  const [weeklyStart, setWeeklyStart] = useState<string>('2026-10-15');
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState<boolean>(false);
  const [newIncidentMachine, setNewIncidentMachine] = useState<string>('');
  const [newIncidentStopMin, setNewIncidentStopMin] = useState<number>(30);
  const [newIncidentReason, setNewIncidentReason] = useState<string>('');
  const [newIncidentNote, setNewIncidentNote] = useState<string>('');
  const [addingIncident, setAddingIncident] = useState<boolean>(false);

  const loadWeeklyReport = async (wStart: string) => {
    setLoadingWeekly(true);
    try {
      const res = await apiClient.get<WeeklyReportData>(
        `/reports/weekly?weekStart=${encodeURIComponent(wStart)}`
      );
      setWeeklyReport(res);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải báo cáo tuần.');
    } finally {
      setLoadingWeekly(false);
    }
  };

  useEffect(() => {
    if (subTab === 'weekly') {
      void loadWeeklyReport(weeklyStart);
    }
  }, [subTab, weeklyStart]);

  const handleAddIncidentNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncidentReason.trim()) {
      toast.warning('Vui lòng nhập nguyên nhân sự cố hoặc dừng máy.');
      return;
    }
    setAddingIncident(true);
    try {
      await apiClient.post('/reports/weekly/incidents', {
        weekStart: weeklyStart,
        machineName: newIncidentMachine,
        stopMinutes: newIncidentStopMin,
        reason: newIncidentReason,
        note: newIncidentNote,
      });
      toast.success('Đã thêm ghi nhận sự cố máy trong tuần.');
      setNewIncidentReason('');
      setNewIncidentNote('');
      void loadWeeklyReport(weeklyStart);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu ghi nhận sự cố.');
    } finally {
      setAddingIncident(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('daily')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              subTab === 'daily'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarClock className="h-4 w-4" />
            <span>1. Kế Hoạch Sản Xuất Ngày (Form VICO QT.01.BM01)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('weekly')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              subTab === 'weekly'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarCheck2 className="h-4 w-4" />
            <span>2. Báo Cáo Tuần (Thứ 5 &rarr; Thứ 4) &amp; Cân Bằng Tải</span>
          </button>
        </div>

        {subTab === 'daily' && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigateTo(`/print/daily-schedule?date=${encodeURIComponent(selectedDate)}`)}
              className="font-bold text-slate-800"
            >
              <Printer className="h-4 w-4 text-blue-600" />
              🖨️ In Biểu Mẫu A4 VICO
            </Button>
            <Button
              type="button"
              variant="success"
              size="sm"
              onClick={handleSaveDailySchedule}
              disabled={savingDaily}
              className="font-bold"
            >
              <Save className="h-4 w-4" />
              {savingDaily ? 'Đang lưu...' : 'Lưu Kế Hoạch Ngày'}
            </Button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: KẾ HOẠCH SẢN XUẤT NGÀY (FORM VICO GCCK.QT.01.BM01)             */}
      {/* ========================================================================= */}
      {subTab === 'daily' && (
        <div className="space-y-4">
          {/* Controls Bar: Date, Shift, Filters */}
          <Card className="border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Ngày lập KH:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Ca làm việc:</span>
                  <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {['ALL', 'Ca 1', 'Ca 2', 'Ca 3', 'Ca Hành chính'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedShift(s)}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                          selectedShift === s
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {s === 'ALL' ? 'Tất Cả Ca' : s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span>Tổng số dòng: <strong>{filteredDailyRows.length}</strong></span>
                <span>&bull;</span>
                <span>Thợ phân công: <strong>{rowsByWorker.length} thợ</strong></span>
                <button
                  type="button"
                  onClick={() => void loadDailyRows(selectedDate)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs hover:bg-slate-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Nạp lại
                </button>
              </div>
            </div>
          </Card>

          {/* Workers Dispatch Cards: Each worker has minimum 3 lines */}
          {loadingDaily ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">
              Đang tải danh sách kế hoạch ngày...
            </div>
          ) : rowsByWorker.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">
              Không có dữ liệu kế hoạch cho ca/ngày này. Bấm &quot;Thêm Hàng&quot; để bắt đầu.
            </Card>
          ) : (
            <div className="space-y-3">
              {rowsByWorker.map(([workerName, workerRows]) => (
                <Card key={workerName} className="overflow-hidden border-slate-200 bg-white p-0">
                  {/* Worker Header Header */}
                  <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 font-extrabold text-xs text-blue-700">
                        {workerName.charAt(0)}
                      </div>
                      <span className="font-extrabold text-sm text-slate-900">{workerName}</span>
                      <Badge variant="info">{workerRows[0]?.row.shiftType || 'Ca 2'}</Badge>
                      <span className="text-xs text-slate-500">
                        ({workerRows.length} mặt hàng / nguyên công)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAddWorkerRow(workerName, workerRows[0]?.row.shiftType || 'Ca 2')}
                        className="text-xs font-bold text-blue-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Thêm Mặt Hàng
                      </Button>
                    </div>
                  </div>

                  {/* 3-Tier Cascade Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left text-xs text-slate-900">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-extrabold uppercase text-slate-700">
                          <th className="w-10 px-3 py-2 text-center">#</th>
                          <th className="w-40 px-3 py-2">Khách Hàng (1)</th>
                          <th className="px-3 py-2">Sản Phẩm / Bản Vẽ (2)</th>
                          <th className="px-3 py-2">Công Đoạn HT (3)</th>
                          <th className="w-24 px-2 py-2 text-center">Kế Hoạch</th>
                          <th className="w-48 px-3 py-2">Máy / Ca</th>
                          <th className="w-44 px-3 py-2">Ghi Chú</th>
                          <th className="w-20 px-2 py-2 text-center">Mã QR</th>
                          <th className="w-10 px-2 py-2 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {workerRows.map(({ row, originalIdx }, rowSubIdx) => {
                          // Cascade: products filtered by customer
                          const filteredProducts = bootstrap.products.filter(
                            (p) => !row.customer || p.customer === row.customer
                          );
                          // Cascade: operations filtered by product
                          const filteredOps = bootstrap.operations.filter(
                            (o) => !row.spId || o.spId === row.spId
                          );

                          const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(
                            `GCCK|${row.customer || 'VICO'}|${row.productName}|${row.workerName}`
                          )}`;

                          return (
                            <tr key={originalIdx} className="hover:bg-blue-50/30">
                              <td className="px-3 py-2 text-center font-mono font-bold text-slate-500">
                                {rowSubIdx + 1}
                              </td>

                              {/* 1. Khách Hàng */}
                              <td className="px-2 py-1.5">
                                <select
                                  value={row.customer}
                                  onChange={(e) =>
                                    handleRowChange(originalIdx, 'customer', e.target.value)
                                  }
                                  className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                                >
                                  <option value="">-- Chọn Khách --</option>
                                  {customerList.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* 2. Sản Phẩm */}
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                  <select
                                    value={row.productName}
                                    onChange={(e) =>
                                      handleRowChange(originalIdx, 'productName', e.target.value)
                                    }
                                    className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                                  >
                                    <option value="">-- Chọn Bản Vẽ / Sản Phẩm --</option>
                                    {filteredProducts.map((p) => (
                                      <option key={p.spId} value={p.productName}>
                                        {p.productName}
                                      </option>
                                    ))}
                                    {row.productName &&
                                      !filteredProducts.some(
                                        (p) => p.productName === row.productName
                                      ) && (
                                        <option value={row.productName}>{row.productName}</option>
                                      )}
                                  </select>
                                  {row.productName && (
                                    <a
                                      href={row.drawingUrl || DEFAULT_DRIVE_FOLDER_URL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                                      title="Xem Bản Vẽ Google Drive"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>
                              </td>

                              {/* 3. Công Đoạn / Nguyên Công */}
                              <td className="px-2 py-1.5">
                                <select
                                  value={row.opName}
                                  onChange={(e) =>
                                    handleRowChange(originalIdx, 'opName', e.target.value)
                                  }
                                  className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
                                >
                                  <option value="">-- Chọn Công Đoạn --</option>
                                  {filteredOps.map((o) => (
                                    <option key={o.ncId} value={o.opName}>
                                      {o.opName}
                                    </option>
                                  ))}
                                  {row.opName &&
                                    !filteredOps.some((o) => o.opName === row.opName) && (
                                      <option value={row.opName}>{row.opName}</option>
                                    )}
                                </select>
                              </td>

                              {/* Kế Hoạch */}
                              <td className="px-2 py-1.5 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={row.plannedQty}
                                  onChange={(e) =>
                                    handleRowChange(
                                      originalIdx,
                                      'plannedQty',
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  className="font-mono-num h-8 w-20 rounded-md border border-slate-300 px-1 text-center text-xs font-extrabold text-blue-700 focus:border-blue-600 focus:outline-none"
                                />
                              </td>

                              {/* Máy / Ca */}
                              <td className="px-2 py-1.5">
                                <select
                                  value={row.machineName}
                                  onChange={(e) =>
                                    handleRowChange(originalIdx, 'machineName', e.target.value)
                                  }
                                  className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
                                >
                                  <option value="">-- Chọn Máy --</option>
                                  {machineList.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                  {row.machineName &&
                                    !machineList.includes(row.machineName) && (
                                      <option value={row.machineName}>{row.machineName}</option>
                                    )}
                                </select>
                              </td>

                              {/* Ghi chú */}
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  value={row.note || ''}
                                  onChange={(e) =>
                                    handleRowChange(originalIdx, 'note', e.target.value)
                                  }
                                  placeholder="Ghi chú / Tăng ca..."
                                  className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                                />
                              </td>

                              {/* Mã QR */}
                              <td className="px-2 py-1.5 text-center">
                                <img
                                  src={qrCodeImgUrl}
                                  alt="QR"
                                  className="mx-auto h-7 w-7 rounded border border-slate-200"
                                />
                              </td>

                              {/* Delete button */}
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(originalIdx)}
                                  className="text-slate-400 hover:text-rose-600"
                                  title="Xóa hàng này"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Quick Note Presets Bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <span className="font-bold text-slate-700">💡 Gợi ý nhanh:</span>
            <span>Mỗi thợ được chia sẵn 3 ô dòng hàng để đảm bảo đủ mặt hàng trong ca. Các dòng không chạy có thể để kế hoạch = 0.</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: BÁO CÁO TUẦN (THỨ 5 -> THỨ 4) & CÂN BẰNG TẢI TUẦN TỚI          */}
      {/* ========================================================================= */}
      {subTab === 'weekly' && (
        <div className="space-y-4">
          {/* Week Selector Bar */}
          <Card className="border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">
                  Chu kỳ Tuần (Thứ 5 &rarr; Thứ 4):
                </span>
                <input
                  type="date"
                  value={weeklyStart}
                  onChange={(e) => setWeeklyStart(e.target.value)}
                  className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                {weeklyReport && (
                  <Badge variant="info" className="font-bold">
                    {weeklyReport.weekLabel}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadWeeklyReport(weeklyStart)}
                  disabled={loadingWeekly}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Làm Mới
                </Button>
              </div>
            </div>
          </Card>

          {loadingWeekly || !weeklyReport ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">
              Đang tổng hợp báo cáo sản xuất tuần &amp; tính toán cân bằng tải...
            </div>
          ) : (
            <div className="space-y-5">
              {/* KHỐI 1: TIẾN ĐỘ ĐƠN HÀNG & SẢN LƯỢNG THEO KHÁCH HÀNG */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-900">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Khối 1: Tổng Hợp Sản Lượng &amp; Tiến Độ Theo Khách Hàng
                  </h3>
                  <Badge
                    variant={weeklyReport.summary.completionPct >= 90 ? 'success' : 'warning'}
                  >
                    Đạt {weeklyReport.summary.completionPct}% Kế Hoạch
                  </Badge>
                </div>

                {/* 4 Metric Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Card className="border-slate-200 bg-white p-3 text-center">
                    <div className="text-[11px] font-bold uppercase text-slate-500">
                      Tổng Kế Hoạch
                    </div>
                    <div className="font-mono-num mt-1 text-xl font-black text-slate-900">
                      {weeklyReport.summary.totalPlannedQty} SP
                    </div>
                  </Card>
                  <Card className="border-slate-200 bg-white p-3 text-center">
                    <div className="text-[11px] font-bold uppercase text-slate-500">
                      Thực Tế Đã Làm
                    </div>
                    <div className="font-mono-num mt-1 text-xl font-black text-emerald-700">
                      {weeklyReport.summary.totalActualQty} SP
                    </div>
                  </Card>
                  <Card className="border-slate-200 bg-white p-3 text-center">
                    <div className="text-[11px] font-bold uppercase text-slate-500">
                      Đơn Đạt Kế Hoạch
                    </div>
                    <div className="font-mono-num mt-1 text-xl font-black text-blue-700">
                      {weeklyReport.summary.completedPoCount} PO
                    </div>
                  </Card>
                  <Card className="border-slate-200 bg-white p-3 text-center">
                    <div className="text-[11px] font-bold uppercase text-slate-500">
                      Đơn Trượt Kế Hoạch
                    </div>
                    <div className="font-mono-num mt-1 text-xl font-black text-rose-700">
                      {weeklyReport.summary.delayedPoCount} PO
                    </div>
                  </Card>
                </div>

                {/* Customer Stats Table */}
                <Card className="overflow-hidden border-slate-200 bg-white p-0">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 font-bold text-xs text-slate-800">
                    Chi tiết sản lượng theo từng đối tác khách hàng
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 font-bold uppercase text-slate-600">
                        <th className="px-4 py-2">Khách Hàng</th>
                        <th className="px-3 py-2 text-center">Số Mặt Hàng</th>
                        <th className="px-3 py-2 text-center">Kế Hoạch</th>
                        <th className="px-3 py-2 text-center">Thực Tế</th>
                        <th className="px-3 py-2 text-center">Tỷ Lệ %</th>
                        <th className="px-4 py-2">Trạng Thái Đơn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-900">
                      {weeklyReport.customerStats.map((cs) => (
                        <tr key={cs.customer} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-extrabold text-blue-700">{cs.customer}</td>
                          <td className="px-3 py-2 text-center">{cs.productCount}</td>
                          <td className="font-mono-num px-3 py-2 text-center">{cs.plannedQty}</td>
                          <td className="font-mono-num px-3 py-2 text-center text-emerald-700 font-extrabold">
                            {cs.actualQty}
                          </td>
                          <td className="font-mono-num px-3 py-2 text-center">
                            <Badge
                              variant={
                                cs.completionPct >= 90
                                  ? 'success'
                                  : cs.completionPct >= 70
                                  ? 'warning'
                                  : 'danger'
                              }
                            >
                              {cs.completionPct}%
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            {cs.completionPct >= 100
                              ? '✅ Hoàn thành đúng tiến độ'
                              : `⏳ Còn thiếu ${Math.max(0, cs.plannedQty - cs.actualQty)} SP`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>

              {/* KHỐI 2: TỔNG HỢP GIỜ CÔNG & LAO ĐỘNG (13 CÔNG NHÂN THỰC TẾ) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-900">
                    <Users className="h-4 w-4 text-emerald-600" />
                    Khối 2: Tổng Hợp Giờ Công &amp; Lao Động (13 Công Nhân Thực Tế)
                  </h3>
                  <span className="text-xs text-slate-600 font-semibold">
                    * Đổi giờ làm thêm &amp; chủ nhật thành ngày công hưởng lương
                  </span>
                </div>

                <Card className="overflow-hidden border-slate-200 bg-white p-0">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 font-bold uppercase text-slate-600">
                        <th className="px-4 py-2.5">Họ Và Tên</th>
                        <th className="px-3 py-2.5 text-center">Công Nhật (Ca chuẩn)</th>
                        <th className="px-3 py-2.5 text-center">Thêm Giờ (OT h)</th>
                        <th className="px-3 py-2.5 text-center">Tăng Ca CN (h)</th>
                        <th className="px-3 py-2.5 text-center">Tổng Công Quy Đổi</th>
                        <th className="px-4 py-2.5 text-center">Sản Lượng SP Làm Ra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-900">
                      {weeklyReport.workerLaborStats.map((w) => (
                        <tr key={w.workerId} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-extrabold text-slate-900">{w.workerName}</td>
                          <td className="font-mono-num px-3 py-2 text-center text-slate-700">
                            {w.standardShifts} ca
                          </td>
                          <td className="font-mono-num px-3 py-2 text-center text-amber-700">
                            {w.otHours > 0 ? `+${w.otHours}h` : '—'}
                          </td>
                          <td className="font-mono-num px-3 py-2 text-center text-violet-700">
                            {w.sundayHours > 0 ? `${w.sundayHours}h` : '—'}
                          </td>
                          <td className="font-mono-num px-3 py-2 text-center font-extrabold text-emerald-800">
                            {w.totalConvertedShifts} công
                          </td>
                          <td className="font-mono-num px-4 py-2 text-center font-bold text-blue-700">
                            {w.actualCompletedPieces} SP
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>

              {/* KHỐI 3: SỰ CỐ THIẾT BỊ & THỜI GIAN DỪNG MÁY (DOWNTIME) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-900">
                    <Wrench className="h-4 w-4 text-amber-600" />
                    Khối 3: Sự Cố Thiết Bị &amp; Thời Gian Dừng Máy Trong Tuần
                  </h3>
                  <Badge variant="warning">
                    {weeklyReport.downtimeIncidents.length} lượt dừng máy
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {/* Shopfloor stoppage logs */}
                  <Card className="border-slate-200 bg-white p-3.5">
                    <div className="mb-2 font-bold text-xs uppercase text-slate-700">
                      Nhật ký dừng máy từ báo cáo phân xưởng
                    </div>
                    {weeklyReport.downtimeIncidents.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500">
                        Không có sự cố dừng máy nào được ghi nhận trong tuần.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {weeklyReport.downtimeIncidents.map((inc) => (
                          <div
                            key={inc.id}
                            className="flex items-start justify-between rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-950"
                          >
                            <div>
                              <span className="font-bold text-slate-900">{inc.machineName}: </span>
                              <span>{inc.reason}</span>
                              <div className="text-[10px] text-slate-600">
                                {inc.date} &bull; Thợ: {inc.workerName || '—'}
                              </div>
                            </div>
                            <span className="font-mono-num shrink-0 font-extrabold text-rose-700">
                              {inc.stopMinutes} phút
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Freeform Add Incident Card (Để trống vài dòng điền thực tế) */}
                  <Card className="border-slate-200 bg-white p-3.5">
                    <div className="mb-2 font-bold text-xs uppercase text-slate-700">
                      Ghi nhận sự cố &amp; tình trạng thiết bị phát sinh (Nhập tay)
                    </div>

                    {weeklyReport.customIncidentNotes.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {weeklyReport.customIncidentNotes.map((note, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800"
                          >
                            &bull; {note}
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleAddIncidentNote} className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newIncidentMachine}
                          onChange={(e) => setNewIncidentMachine(e.target.value)}
                          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:outline-none"
                        >
                          <option value="">-- Chọn máy gặp sự cố --</option>
                          {machineList.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          value={newIncidentStopMin}
                          onChange={(e) => setNewIncidentStopMin(Number(e.target.value) || 0)}
                          placeholder="Phút dừng máy"
                          className="font-mono-num h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-900 focus:outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        value={newIncidentReason}
                        onChange={(e) => setNewIncidentReason(e.target.value)}
                        placeholder="Nội dung sự cố: hỏng dao, kẹt phôi, rò dầu..."
                        className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs text-slate-900 focus:outline-none"
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        disabled={addingIncident}
                        className="w-full font-bold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {addingIncident ? 'Đang lưu...' : 'Thêm Dòng Ghi Chú Sự Cố'}
                      </Button>
                    </form>
                  </Card>
                </div>
              </div>

              {/* KHỐI 4: KẾ HOẠCH TUẦN TỚI & ĐỀ XUẤT GIA CÔNG NGOÀI */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-900">
                    <Truck className="h-4 w-4 text-purple-600" />
                    Khối 4: Kế Hoạch Tuần Tới &amp; Đề Xuất Gia Công Ngoài (Outsource)
                  </h3>
                  {weeklyReport.nextWeekForecast.isOverloaded ? (
                    <Badge variant="danger" className="animate-pulse">
                      ⚠️ Vượt Khung Năng Lực Máy
                    </Badge>
                  ) : (
                    <Badge variant="success">Đủ Máy Hoàn Thành Kế Hoạch</Badge>
                  )}
                </div>

                {/* Capacity Balance Warning */}
                <Card
                  className={`p-4 border ${
                    weeklyReport.nextWeekForecast.isOverloaded
                      ? 'border-rose-300 bg-rose-50 text-rose-950'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-950'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-sm">
                        {weeklyReport.nextWeekForecast.isOverloaded
                          ? '⚠️ CẢNH BÁO: TỔNG GIỜ MÁY CẦN THIẾT VƯỢT QUÁ KHẢ NĂNG PHÂN XƯỞNG'
                          : '✅ ĐỦ NĂNG LỰC 23 MÁY ĐÁP ỨNG KẾ HOẠCH TUẦN TỚI'}
                      </div>
                      <div className="mt-1 text-xs">
                        Số lượng thiếu tuần trước cần bù:{' '}
                        <strong>{weeklyReport.nextWeekForecast.carryoverBacklogQty} SP</strong> &bull; Tổng
                        giờ gia công tuần tới: <strong>{weeklyReport.nextWeekForecast.totalRequiredHours}h</strong> / Khả dụng:{' '}
                        <strong>{weeklyReport.nextWeekForecast.machineCapacityHours}h</strong>.
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Outsource Recommendations Table */}
                {weeklyReport.nextWeekForecast.outsourceRecommendations.length > 0 && (
                  <Card className="overflow-hidden border-slate-200 bg-white p-0">
                    <div className="border-b border-slate-200 bg-purple-50 px-4 py-2 font-bold text-xs text-purple-900">
                      📋 Danh sách đề xuất chuyển gia công ngoài (tránh trễ hạn khách hàng)
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/60 font-bold uppercase text-slate-600">
                          <th className="px-4 py-2">Đơn Hàng / Chi Tiết</th>
                          <th className="px-3 py-2">Khách Hàng</th>
                          <th className="px-3 py-2 text-center">SL Đề Xuất Chuyển</th>
                          <th className="px-4 py-2">Lý Do Đề Xuất</th>
                          <th className="px-4 py-2 text-right">Chi Phí Dự Kiến</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-900">
                        {weeklyReport.nextWeekForecast.outsourceRecommendations.map((rec) => (
                          <tr key={rec.poId} className="hover:bg-purple-50/20">
                            <td className="px-4 py-2 font-bold text-blue-700">
                              {rec.poId} &bull; {rec.productName}
                            </td>
                            <td className="px-3 py-2">{rec.customer}</td>
                            <td className="font-mono-num px-3 py-2 text-center font-extrabold text-purple-800">
                              {rec.suggestedOutsourceQty} SP
                            </td>
                            <td className="px-4 py-2 text-slate-700">{rec.reason}</td>
                            <td className="font-mono-num px-4 py-2 text-right font-extrabold text-slate-900">
                              {formatVnd(rec.estimatedOutsourceCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
