import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  ClipboardList,
  Coins,
  Command,
  Cpu,
  KeyRound,
  LayoutDashboard,
  Lock,
  Menu,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { BootstrapPayload } from '@shared/types';
import { matchesSearch } from '@shared/vnSearch';
import { apiClient } from '@client/lib/apiClient';
import { formatDateVn, formatNumber } from '@client/lib/formatters';
import { navigateTo } from '@client/lib/navigation';
import {
  Badge,
  Button,
  Card,
  Modal,
  useToast,
} from '@client/components/ui/IndustrialPrimitives';
import { useAuth } from '@client/context/AuthContext';
import type { AdminDeepLinkContext, AdminTabKey } from './types';
import { CockpitAndLoadTab } from './tabs/CockpitAndLoadTab';
import { OrdersAndTravelerTab } from './tabs/OrdersAndTravelerTab';
import { LogsQcTraceTab } from './tabs/LogsQcTraceTab';
import { CostingPnlTab } from './tabs/CostingPnlTab';
import { AttendancePayrollTab } from './tabs/AttendancePayrollTab';
import { MasterAndConfigTab } from './tabs/MasterAndConfigTab';

interface NavTabItem {
  key: AdminTabKey;
  shortLabel: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  financialOnly?: boolean;
  badgeText?: string;
  badgeVariant?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple';
}

interface CommandHit {
  id: string;
  category: 'PO' | 'TRACE' | 'PRODUCT' | 'OPERATION' | 'MACHINE' | 'WORKER';
  code: string;
  title: string;
  subtitle: string;
  targetTab: AdminTabKey;
  deepLink: AdminDeepLinkContext;
}

export function AdminPortal() {
  const toast = useToast();
  const { user, authMode, loading: authLoading, quickSwitch, openPinModal } = useAuth();

  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<AdminTabKey>('cockpit');
  const [deepLink, setDeepLink] = useState<AdminDeepLinkContext | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Ctrl+K Global Command Palette state
  const [cmdOpen, setCmdOpen] = useState<boolean>(false);
  const [cmdQuery, setCmdQuery] = useState<string>('');
  const [cmdSelectedIdx, setCmdSelectedIdx] = useState<number>(0);
  const cmdInputRef = useRef<HTMLInputElement | null>(null);

  const canEnterManagement =
    user?.appRole === 'ADMIN' ||
    user?.appRole === 'DIRECTOR' ||
    user?.appRole === 'SHIFT_LEADER' ||
    user?.appRole === 'QC';

  const canViewCosting =
    user?.appRole === 'ADMIN' || user?.appRole === 'DIRECTOR';

  const fetchBootstrap = useCallback(
    async (silent = false) => {
      if (!user || !canEnterManagement) {
        setLoadingData(false);
        return;
      }
      if (silent) {
        setRefreshing(true);
      } else {
        setLoadingData(true);
      }
      setLoadError('');
      try {
        const data = await apiClient.get<BootstrapPayload>('/bootstrap');
        setBootstrap(data);
      } catch (err: any) {
        const msg = err?.message || 'Không thể tải dữ liệu Trung tâm Điều hành.';
        setLoadError(msg);
        if (silent) toast.error(msg);
      } finally {
        setLoadingData(false);
        setRefreshing(false);
      }
    },
    [user, canEnterManagement, toast]
  );

  useEffect(() => {
    if (!authLoading) {
      void fetchBootstrap(Boolean(bootstrap));
    }
  }, [authLoading, user?.workerId, user?.appRole]);

  // If QC switches in, default them straight to Logs/QC if they were on costing
  useEffect(() => {
    if (!canViewCosting && activeTab === 'costing') {
      setActiveTab(user?.appRole === 'QC' ? 'logs_qc' : 'cockpit');
    }
  }, [canViewCosting, activeTab, user?.appRole]);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (canEnterManagement && bootstrap) {
          setCmdOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEnterManagement, bootstrap]);

  useEffect(() => {
    if (cmdOpen) {
      setCmdSelectedIdx(0);
      window.setTimeout(() => cmdInputRef.current?.focus(), 40);
    } else {
      setCmdQuery('');
    }
  }, [cmdOpen]);

  const handleNavigateTab = useCallback(
    (tab: AdminTabKey, ctx?: AdminDeepLinkContext) => {
      if (tab === 'costing' && !canViewCosting) {
        toast.warning('Phân hệ Báo giá & Lãi/Lỗ chỉ dành cho Quản đốc / Ban Giám đốc.');
        return;
      }
      setActiveTab(tab);
      setDeepLink(ctx ? { ...ctx } : undefined);
      setMobileDrawerOpen(false);
    },
    [canViewCosting, toast]
  );

  const pendingFaiCount = useMemo(() => {
    if (!bootstrap) return 0;
    return bootstrap.ordersList.filter((po) => po.faiStatus === 'PENDING_FAI').length;
  }, [bootstrap]);

  const navTabs = useMemo<NavTabItem[]>(() => {
    const kpi = bootstrap?.kpiSummary;
    const allTabs: NavTabItem[] = [
      {
        key: 'cockpit',
        shortLabel: 'Điều Độ & Tải',
        label: '1. Tổng Quan & Điều Độ Tải Máy',
        subtitle: 'Cân bằng tải 23+ máy CNC, SMED, Lịch ca & WIP tỷ trọng',
        icon: LayoutDashboard,
        badgeText:
          kpi && kpi.bottleneckMachines > 0
            ? `${kpi.bottleneckMachines} nghẽn`
            : `${bootstrap?.machines.length ?? 23} máy`,
        badgeVariant: kpi && kpi.bottleneckMachines > 0 ? 'danger' : 'info',
      },
      {
        key: 'orders',
        shortLabel: 'Lệnh PO & QR',
        label: '2. Lệnh Sản Xuất PO & Phiếu QR',
        subtitle: 'Theo dõi tiến độ 189+ PO, xuất kho từng phần & in Phiếu công nghệ',
        icon: ClipboardList,
        badgeText:
          kpi && kpi.overdueOrders > 0
            ? `${kpi.overdueOrders} trễ`
            : `${bootstrap?.ordersList.length ?? 0} PO`,
        badgeVariant: kpi && kpi.overdueOrders > 0 ? 'warning' : 'neutral',
      },
      {
        key: 'logs_qc',
        shortLabel: 'Nhật Ký & QC',
        label: '3. Nhật Ký Ca, QA/QC 3 Tầng & Truy Xuất',
        subtitle: 'Đối soát sản lượng thực, duyệt FAI/IPQC/OQC ±0.01mm & phả hệ lô phôi',
        icon: ShieldCheck,
        badgeText:
          pendingFaiCount > 0
            ? `${pendingFaiCount} chờ FAI`
            : `${bootstrap?.recentLogs.length ?? 0} ca`,
        badgeVariant: pendingFaiCount > 0 ? 'warning' : 'success',
      },
      {
        key: 'costing',
        shortLabel: 'Báo Giá P&L',
        label: '4. Báo Giá & Đối Soát Lãi/Lỗ (P&L)',
        subtitle: 'Giá thành thực tế vs định mức 334+ SP, chống báo lãi ảo bán thành phẩm',
        icon: Coins,
        financialOnly: true,
        badgeText: `${bootstrap?.products.length ?? 0} SP`,
        badgeVariant: 'purple',
      },
      {
        key: 'attendance',
        shortLabel: 'Chấm Công & 3P',
        label: '5. Chấm Công Ma Trận & Lương 3P',
        subtitle: '6 bảng chấm công 60fps, phụ cấp ăn ca thống nhất & quyết toán 3P',
        icon: CalendarCheck2,
        badgeText: `${bootstrap?.workers.length ?? 16} NV`,
        badgeVariant: 'info',
      },
      {
        key: 'master',
        shortLabel: 'Master & Hệ Thống',
        label: '6. Danh Mục Master & Cấu Hình',
        subtitle: '627+ NC, Tủ dao 1-đổi-1, Tài khoản PIN scrypt & Cloud Sync Outbox',
        icon: Settings,
        badgeText: `${bootstrap?.operations.length ?? 0} NC`,
        badgeVariant: 'neutral',
      },
    ];

    return allTabs.filter((t) => !t.financialOnly || canViewCosting);
  }, [bootstrap, canViewCosting, pendingFaiCount]);

  const activeTabMeta = useMemo(
    () => navTabs.find((t) => t.key === activeTab) || navTabs[0],
    [navTabs, activeTab]
  );

  // ==================== CTRL+K GLOBAL COMMAND PALETTE RESULTS ====================
  const commandHits = useMemo<CommandHit[]>(() => {
    if (!bootstrap) return [];
    const q = cmdQuery.trim();
    const hits: CommandHit[] = [];

    // 1. Purchase Orders (PO + Traceability)
    for (const po of bootstrap.ordersList) {
      if (
        !q ||
        matchesSearch(`${po.poId} ${po.customer} ${po.productName} ${po.materialLot || ''}`, q)
      ) {
        hits.push({
          id: `po-${po.poId}`,
          category: 'PO',
          code: po.poId,
          title: `${po.productName} (${po.customer})`,
          subtitle: `SL đặt: ${po.qtyPo} | Đã xong: ${po.finishedQty} | Hạn giao: ${formatDateVn(po.dueDate)}`,
          targetTab: 'orders',
          deepLink: { ordersSearch: po.poId },
        });
        if (q && hits.length < 30) {
          hits.push({
            id: `trace-${po.poId}`,
            category: 'TRACE',
            code: `TRUY XUẤT ${po.poId}`,
            title: `Phả hệ Lô phôi & Lịch sử QC: ${po.productName}`,
            subtitle: `Lô phôi: ${po.materialLot || 'Chuẩn VICO'} — Mở cây truy xuất 4 tầng`,
            targetTab: 'logs_qc',
            deepLink: { logsSubView: 'TRACE', tracePoId: po.poId },
          });
        }
      }
      if (!q && hits.length >= 6) break;
      if (hits.length >= 28) break;
    }

    // 2. Products
    for (const p of bootstrap.products) {
      if (hits.length >= 40) break;
      if (!q && hits.length >= 10) break;
      if (!q || matchesSearch(`${p.spId} ${p.customer} ${p.productName}`, q)) {
        hits.push({
          id: `prod-${p.spId}`,
          category: 'PRODUCT',
          code: p.spId,
          title: p.productName,
          subtitle: canViewCosting
            ? `${p.customer} — Mở phân tích Báo giá & Giá thành P&L`
            : `${p.customer} — Xem danh mục quy trình công nghệ`,
          targetTab: canViewCosting ? 'costing' : 'master',
          deepLink: canViewCosting
            ? { costingSearch: p.spId }
            : { masterSubTab: 'OPS', masterSearch: p.spId },
        });
      }
    }

    // 3. Operations
    if (q) {
      for (const op of bootstrap.operations) {
        if (hits.length >= 52) break;
        if (
          matchesSearch(
            `${op.ncId} ${op.spId} ${op.productName} ${op.opName} ${op.defaultMachine}`,
            q
          )
        ) {
          hits.push({
            id: `op-${op.ncId}`,
            category: 'OPERATION',
            code: op.ncId,
            title: `${op.opName} — ${op.productName}`,
            subtitle: `Bước ${op.stepOrder} | ĐM ${op.stdSeconds}s | Máy: ${op.defaultMachine}`,
            targetTab: 'master',
            deepLink: { masterSubTab: 'OPS', masterSearch: op.ncId },
          });
        }
      }
    }

    // 4. Machines
    for (const m of bootstrap.machines) {
      if (hits.length >= 60) break;
      if (!q && hits.length >= 14) break;
      if (!q || matchesSearch(`${m.id} ${m.name} ${m.group}`, q)) {
        hits.push({
          id: `mach-${m.id}`,
          category: 'MACHINE',
          code: m.id,
          title: m.name,
          subtitle: `Nhóm: ${m.group} | Trạng thái: ${m.status || 'IDLE'}`,
          targetTab: 'master',
          deepLink: { masterSubTab: 'MACHINES_TOOLS', masterSearch: m.name },
        });
      }
    }

    // 5. Workers
    for (const w of bootstrap.workers) {
      if (hits.length >= 68) break;
      if (!q && hits.length >= 18) break;
      if (!q || matchesSearch(`${w.id} ${w.name} ${w.title}`, q)) {
        hits.push({
          id: `emp-${w.id}`,
          category: 'WORKER',
          code: w.id,
          title: `${w.name} (${w.title})`,
          subtitle: `Mở Bảng chấm công & Lương 3P của ${w.name}`,
          targetTab: 'attendance',
          deepLink: { attendanceSearch: w.id },
        });
      }
    }

    return hits;
  }, [bootstrap, cmdQuery, canViewCosting]);

  const executeCommandHit = (hit: CommandHit) => {
    setCmdOpen(false);
    handleNavigateTab(hit.targetTab, hit.deepLink);
  };

  // ==================== GATE 1: LOADING AUTH ====================
  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-[1920px] items-center justify-center p-6">
        <Card className="flex items-center gap-3 px-6 py-5">
          <RefreshCw className="h-5 w-5 animate-spin text-sky-400" />
          <span className="text-sm font-semibold text-slate-200">
            Đang khởi tạo Trung tâm Điều hành Quản đốc...
          </span>
        </Card>
      </main>
    );
  }

  // ==================== GATE 2: WORKER OR UNLOCKED SESSION ====================
  if (!user || !canEnterManagement) {
    return (
      <main className="mx-auto flex min-h-[78vh] w-full max-w-[1920px] items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-xl space-y-5 border-sky-500/40 p-6 shadow-2xl">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-500/40 bg-sky-500/15 text-sky-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-50">
                Cổng Điều Hành Dành Cho Quản Đốc, Trưởng Ca &amp; QC
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {user
                  ? `Phiên hiện tại đang là Công nhân đứng máy: ${user.name} (${user.workerId}). Để bảo mật đơn giá khách hàng, bảng lương toàn xưởng và kế hoạch tải máy, vui lòng chuyển sang vai trò Quản lý.`
                  : 'Phiên làm việc hiện đang ở chế độ Strict PIN hoặc đã đăng xuất. Vui lòng xác thực mã PIN Quản lý để vào Trung tâm Điều hành.'}
              </p>
            </div>
          </div>

          {authMode === 'DEMO_QUICK' && (
            <div className="space-y-2 rounded-xl border border-industrial-border bg-slate-950/80 p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                ⚡ Chuyển nhanh 1 chạm (Chế độ Demo Quick-Switch đang bật)
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void quickSwitch({ workerId: 'NV00053' })}
                >
                  🛡️ Quản Đốc Admin
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void quickSwitch({ workerId: 'NV00266' })}
                >
                  📋 Trưởng Ca SX
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void quickSwitch({ workerId: 'NV_KT02' })}
                >
                  🔬 Kiểm Soát QC
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              variant="ghost"
              size="md"
              onClick={() => navigateTo('/worker')}
            >
              <Smartphone className="h-4 w-4" />
              Về Cổng Công Nhân (/worker)
            </Button>
            <Button
              variant="warning"
              size="md"
              onClick={() => openPinModal('NV00053')}
            >
              <KeyRound className="h-4 w-4" />
              Mở Khóa Bằng Mã PIN Quản Đốc
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  // ==================== GATE 3: LOADING BOOTSTRAP ====================
  if (loadingData && !bootstrap) {
    return (
      <main className="mx-auto flex min-h-[72vh] w-full max-w-[1920px] items-center justify-center p-6">
        <Card className="flex flex-col items-center gap-3 px-8 py-6 text-center">
          <RefreshCw className="h-7 w-7 animate-spin text-sky-400" />
          <div className="text-sm font-bold text-slate-100">
            Đang đồng bộ CSDL Lean MES (189 PO · 334 SP · 627 NC · 23 Máy)...
          </div>
          <div className="text-xs text-slate-400">
            Tính toán cân bằng tải máy CNC & tiến độ WIP thời gian thực
          </div>
        </Card>
      </main>
    );
  }

  if (!bootstrap) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-[1920px] items-center justify-center p-6">
        <Card className="max-w-md space-y-3 border-red-500/40 p-5 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <div className="text-sm font-bold text-red-200">
            {loadError || 'Không tải được dữ liệu máy chủ.'}
          </div>
          <Button variant="primary" size="sm" onClick={() => void fetchBootstrap(false)}>
            <RefreshCw className="h-4 w-4" /> Thử tải lại ngay
          </Button>
        </Card>
      </main>
    );
  }

  // ==================== MAIN COMMAND CENTER LAYOUT ====================
  const renderSidebarNav = (isMobile = false) => {
    const collapsed = !isMobile && sidebarCollapsed;
    return (
      <div className="flex h-full flex-col justify-between">
        <div className="space-y-1.5 p-2.5">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            {!collapsed && (
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                6 Phân Hệ Điều Hành
              </span>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-industrial-border bg-industrial-elevated text-slate-300 hover:bg-slate-700 hover:text-white"
                title={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {navTabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigateTab(item.key)}
                title={collapsed ? `${item.label} — ${item.subtitle}` : undefined}
                className={`group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  active
                    ? 'border-sky-400/60 bg-sky-500/15 text-sky-200 shadow-md'
                    : 'border-transparent text-slate-300 hover:border-slate-700/80 hover:bg-slate-800/60 hover:text-white'
                } ${collapsed ? 'justify-center px-2' : ''}`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    active ? 'text-sky-400' : 'text-slate-400 group-hover:text-sky-300'
                  }`}
                />
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold leading-snug">
                        {item.shortLabel}
                      </div>
                      <div className="truncate text-[10px] text-slate-400">
                        {item.key === 'cockpit'
                          ? 'Gantt, SMED & WIP'
                          : item.key === 'orders'
                            ? 'PO & Phiếu QR A4'
                            : item.key === 'logs_qc'
                              ? 'Logs, FAI & Trace'
                              : item.key === 'costing'
                                ? 'Lãi/Lỗ thực tế'
                                : item.key === 'attendance'
                                  ? '6 Bảng công & 3P'
                                  : 'Master & Outbox'}
                      </div>
                    </div>
                    {item.badgeText && (
                      <Badge
                        variant={item.badgeVariant || 'neutral'}
                        className="font-mono-num shrink-0 text-[10px]"
                      >
                        {item.badgeText}
                      </Badge>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Sidebar Info & Role Upgrade Card */}
        <div className="border-t border-industrial-border p-2.5 space-y-2">
          {!canViewCosting && !collapsed && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 text-[11px] text-amber-200/90 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Lock className="h-3.5 w-3.5" /> Đang ẩn Báo giá P&amp;L
              </div>
              <p className="text-[10px] text-amber-100/75 leading-snug">
                Tài khoản {user.title} không hiển thị giá báo khách hàng.
              </p>
              {authMode === 'DEMO_QUICK' ? (
                <button
                  type="button"
                  onClick={() => void quickSwitch({ workerId: 'NV00053' })}
                  className="w-full rounded-lg bg-amber-500/20 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30"
                >
                  ⚡ Chuyển Quản đốc
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openPinModal('NV00053')}
                  className="w-full rounded-lg bg-amber-500/20 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30"
                >
                  🔑 Nhập PIN Admin
                </button>
              )}
            </div>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={() => navigateTo('/andon')}
              className="flex w-full items-center justify-between rounded-xl border border-industrial-border bg-industrial-elevated px-3 py-2 text-xs font-bold text-emerald-300 hover:border-emerald-500/50 hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">
                <MonitorPlay className="h-4 w-4" /> Mở Màn Hình Andon TV
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[1920px]">
      {/* DESKTOP COLLAPSIBLE LEFT SIDEBAR */}
      <aside
        className={`no-print hidden shrink-0 border-r border-industrial-border bg-industrial-surface/90 lg:block transition-all duration-200 ${
          sidebarCollapsed ? 'w-[70px]' : 'w-64'
        }`}
      >
        <div className="sticky top-[56px] h-[calc(100vh-56px)] overflow-y-auto">
          {renderSidebarNav(false)}
        </div>
      </aside>

      {/* MOBILE / TABLET SLIDE-OVER DRAWER */}
      {mobileDrawerOpen && (
        <div
          className="no-print fixed inset-0 z-[75] flex bg-black/75 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-72 max-w-[85vw] flex-col border-r border-industrial-border bg-industrial-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-industrial-border px-4 py-3">
              <div className="text-sm font-extrabold text-slate-100">
                GCCK Thắng Lợi MES
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-lg border border-industrial-border bg-industrial-elevated p-1.5 text-slate-300"
                aria-label="Đóng menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderSidebarNav(true)}</div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP COMMAND BAR */}
        <header className="no-print sticky top-[56px] z-30 border-b border-industrial-border bg-industrial-canvas/95 px-3 py-2.5 backdrop-blur-md sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-industrial-border bg-industrial-elevated text-slate-200 hover:bg-slate-700 lg:hidden"
                aria-label="Mở danh mục phân hệ"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-sm font-extrabold text-slate-50 sm:text-base">
                    {activeTabMeta?.label}
                  </h1>
                  <Badge variant="neutral" className="font-mono-num hidden sm:inline-flex">
                    Ngày SX: {formatDateVn(bootstrap.vietnamToday)}
                  </Badge>
                </div>
                <p className="hidden truncate text-xs text-slate-400 md:block">
                  {activeTabMeta?.subtitle}
                </p>
              </div>
            </div>

            {/* RIGHT ACTIONS: LIVE PULSE PILLS + CTRL+K + REFRESH */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden xl:flex items-center gap-1.5 rounded-xl border border-industrial-border bg-industrial-surface px-3 py-1.5 text-xs">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-slate-400">Chạy:</span>
                <strong className="font-mono-num text-emerald-300">
                  {bootstrap.kpiSummary.runningMachines}/{bootstrap.machines.length}
                </strong>
                <span className="mx-1 text-slate-700">|</span>
                <span className="text-slate-400">OK lũy kế:</span>
                <strong className="font-mono-num text-sky-300">
                  {formatNumber(bootstrap.kpiSummary.totalOk)}
                </strong>
                {bootstrap.shiftHandoverAlerts.length > 0 && (
                  <>
                    <span className="mx-1 text-slate-700">|</span>
                    <span className="text-amber-300 font-semibold">
                      📝 {bootstrap.shiftHandoverAlerts.length} dặn ca
                    </span>
                  </>
                )}
              </div>

              {/* CTRL+K QUICK COMMAND SEARCH TRIGGER */}
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-industrial-border bg-industrial-elevated px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-sky-400/60 hover:text-white"
              >
                <Search className="h-3.5 w-3.5 text-sky-400" />
                <span className="hidden sm:inline">Tra nhanh PO, SP, NC, Máy...</span>
                <span className="sm:hidden">Tìm nhanh</span>
                <kbd className="font-mono-num rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                  Ctrl+K
                </kbd>
              </button>

              <Button
                variant="secondary"
                size="sm"
                disabled={refreshing}
                onClick={() => void fetchBootstrap(true)}
                title="Đồng bộ lại toàn bộ dữ liệu thời gian thực"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
                <span className="hidden sm:inline">Làm mới</span>
              </Button>
            </div>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <main className="w-full flex-1 p-3 sm:p-5">
          {activeTab === 'cockpit' && (
            <CockpitAndLoadTab
              bootstrap={bootstrap}
              onRefreshBootstrap={() => fetchBootstrap(true)}
              onNavigateTab={handleNavigateTab}
              deepLink={deepLink}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersAndTravelerTab
              bootstrap={bootstrap}
              onRefreshBootstrap={() => fetchBootstrap(true)}
              onNavigateTab={handleNavigateTab}
              deepLink={deepLink}
            />
          )}

          {activeTab === 'logs_qc' && (
            <LogsQcTraceTab
              bootstrap={bootstrap}
              onRefreshBootstrap={() => fetchBootstrap(true)}
              onNavigateTab={handleNavigateTab}
              deepLink={deepLink}
            />
          )}

          {activeTab === 'costing' &&
            (canViewCosting ? (
              <CostingPnlTab
                bootstrap={bootstrap}
                onRefreshBootstrap={() => fetchBootstrap(true)}
                onNavigateTab={handleNavigateTab}
                deepLink={deepLink}
              />
            ) : (
              <Card className="mx-auto max-w-lg space-y-3 border-amber-500/40 p-6 text-center">
                <Lock className="mx-auto h-8 w-8 text-amber-400" />
                <h2 className="text-base font-bold text-slate-100">
                  Phân Hệ Báo Giá &amp; Lãi/Lỗ Chỉ Dành Cho Quản Đốc / Giám Đốc
                </h2>
                <p className="text-xs text-slate-400">
                  Đơn giá chào khách hàng và biên lợi nhuận ròng được bảo mật theo phân quyền RBAC.
                </p>
              </Card>
            ))}

          {activeTab === 'attendance' && (
            <AttendancePayrollTab
              bootstrap={bootstrap}
              onRefreshBootstrap={() => fetchBootstrap(true)}
              onNavigateTab={handleNavigateTab}
              deepLink={deepLink}
            />
          )}

          {activeTab === 'master' && (
            <MasterAndConfigTab
              bootstrap={bootstrap}
              onRefreshBootstrap={() => fetchBootstrap(true)}
              onNavigateTab={handleNavigateTab}
              deepLink={deepLink}
            />
          )}
        </main>
      </div>

      {/* ==================== CTRL+K GLOBAL COMMAND SEARCH MODAL ==================== */}
      <Modal
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        title="Tìm Kiếm & Điều Hướng Tức Thì (Command Center)"
        subtitle="Gõ không dấu để nhảy thẳng tới Lệnh PO, Cây truy xuất, Sản phẩm, Nguyên công, Máy hoặc Nhân sự"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-3">
          <div className="relative">
            <Command className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
            <input
              ref={cmdInputRef}
              type="text"
              value={cmdQuery}
              onChange={(e) => {
                setCmdQuery(e.target.value);
                setCmdSelectedIdx(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setCmdSelectedIdx((i) =>
                    Math.min(commandHits.length - 1, Math.max(0, i + 1))
                  );
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setCmdSelectedIdx((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter' && commandHits[cmdSelectedIdx]) {
                  e.preventDefault();
                  executeCommandHit(commandHits[cmdSelectedIdx]);
                }
              }}
              placeholder="VD: PO485, SP095, NC0120, Tiện CNC 1, NV00214, truc vit..."
              className="min-h-[46px] w-full rounded-xl border border-sky-500/50 bg-slate-950 pl-10 pr-4 text-sm font-semibold text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div className="max-h-[380px] divide-y divide-slate-800/80 overflow-y-auto rounded-xl border border-industrial-border bg-slate-950/60">
            {commandHits.map((hit, idx) => {
              const selected = idx === cmdSelectedIdx;
              const catBadge =
                hit.category === 'PO'
                  ? { label: 'LỆNH PO', variant: 'info' as const }
                  : hit.category === 'TRACE'
                    ? { label: 'PHẢ HỆ QC', variant: 'success' as const }
                    : hit.category === 'PRODUCT'
                      ? { label: 'SẢN PHẨM', variant: 'purple' as const }
                      : hit.category === 'OPERATION'
                        ? { label: 'NGUYÊN CÔNG', variant: 'warning' as const }
                        : hit.category === 'MACHINE'
                          ? { label: 'MÁY CNC', variant: 'neutral' as const }
                          : { label: 'NHÂN SỰ', variant: 'info' as const };

              return (
                <button
                  key={hit.id}
                  type="button"
                  onMouseEnter={() => setCmdSelectedIdx(idx)}
                  onClick={() => executeCommandHit(hit)}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${
                    selected ? 'bg-sky-500/15' : 'hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={catBadge.variant} className="text-[10px]">
                        {catBadge.label}
                      </Badge>
                      <span className="font-mono-num text-xs font-bold text-sky-300">
                        {hit.code}
                      </span>
                      <span className="truncate text-xs font-semibold text-slate-100">
                        {hit.title}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">
                      {hit.subtitle}
                    </div>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 ${
                      selected ? 'text-sky-400' : 'text-slate-600'
                    }`}
                  />
                </button>
              );
            })}

            {commandHits.length === 0 && (
              <div className="py-10 text-center text-xs text-slate-400">
                Không tìm thấy kết quả khớp với từ khóa &ldquo;{cmdQuery}&rdquo;.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Dùng phím ↑ ↓ để chọn, Enter để mở nhanh, Esc để đóng</span>
            <span className="font-mono-num">{commandHits.length} kết quả</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminPortal;
