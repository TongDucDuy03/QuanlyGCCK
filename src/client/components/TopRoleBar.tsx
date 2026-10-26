import React, { useEffect, useState } from 'react';
import {
  ChevronUp,
  CloudOff,
  Factory,
  KeyRound,
  MonitorPlay,
  Printer,
  Shield,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge, useToast } from './ui/IndustrialPrimitives';
import { navigateTo } from '../lib/navigation';
import {
  flushOfflineOutbox,
  getOfflineOutbox,
  subscribeOfflineOutbox,
} from '../lib/offlineOutbox';

export interface TopRoleBarProps {
  currentPath: string;
}

export function TopRoleBar({ currentPath }: TopRoleBarProps) {
  const { user, authMode, quickSwitch, openPinModal } = useAuth();
  const toast = useToast();
  const [collapsedKiosk, setCollapsedKiosk] = useState(false);
  const [outboxCount, setOutboxCount] = useState<number>(() => getOfflineOutbox().length);

  useEffect(() => {
    return subscribeOfflineOutbox((items) => setOutboxCount(items.length));
  }, []);

  const isAndon = currentPath.startsWith('/andon');

  if (isAndon && collapsedKiosk) {
    return (
      <div className="no-print fixed right-3 top-2 z-50">
        <button
          type="button"
          onClick={() => setCollapsedKiosk(false)}
          className="rounded-lg border border-industrial-border bg-slate-900/90 px-2.5 py-1 text-xs font-semibold text-slate-300 shadow-lg hover:bg-slate-800 hover:text-white"
        >
          Hiện thanh chuyển cổng
        </button>
      </div>
    );
  }

  const handleRoleNav = async (
    targetPath: string,
    targetWorkerId?: string,
    label?: string
  ) => {
    try {
      if (targetWorkerId) {
        if (authMode === 'DEMO_QUICK') {
          if (user?.workerId !== targetWorkerId) {
            await quickSwitch({ workerId: targetWorkerId });
          }
        } else if (!user || (targetPath.startsWith('/admin') && user.appRole === 'WORKER')) {
          openPinModal(targetWorkerId);
          return;
        }
      }
      navigateTo(targetPath);
      if (label) toast.info(`Đã chuyển sang ${label}`);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể chuyển vai trò.');
      openPinModal(targetWorkerId);
    }
  };

  const isWorkerActive = currentPath === '/' || currentPath.startsWith('/worker');
  const isQcActive =
    currentPath.startsWith('/admin') &&
    (user?.appRole === 'QC' || user?.appRole === 'SHIFT_LEADER');
  const isAdminActive =
    currentPath.startsWith('/admin') &&
    user?.appRole !== 'QC' &&
    user?.appRole !== 'SHIFT_LEADER';
  const isPrintActive = currentPath.startsWith('/print/');

  const pillCls = (active: boolean) =>
    `inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
      active
        ? 'border-sky-400/70 bg-sky-500/20 text-sky-200 shadow-sm'
        : 'border-industrial-border bg-industrial-elevated/80 text-slate-300 hover:border-slate-500 hover:text-white'
    }`;

  return (
    <header className="no-print relative md:sticky md:top-0 z-40 w-full max-w-full border-b border-industrial-border bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 sm:px-4">
        {/* Brand Identity */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-400/40 bg-sky-500/15 text-sky-300">
            <Factory className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-extrabold tracking-wide text-slate-100 sm:text-sm">
              GCCK THẮNG LỢI <span className="text-sky-400">LEAN MES</span>
            </div>
          </div>
        </div>

        {/* 1-Click Role & Shell Switcher */}
        <nav
          aria-label="Chuyển nhanh cổng giao diện"
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() =>
              void handleRoleNav(
                '/worker',
                user?.appRole === 'WORKER' ? user.workerId : 'NV00214',
                '📱 Cổng Công Nhân'
              )
            }
            className={pillCls(isWorkerActive)}
          >
            <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
            <span>Công Nhân</span>
          </button>

          <button
            type="button"
            onClick={() => void handleRoleNav('/admin', 'NV_KT02', '🔍 Tổ Trưởng / QC')}
            className={pillCls(isQcActive)}
          >
            <UserCheck className="h-3.5 w-3.5 text-amber-400" />
            <span>Tổ Trưởng / QC</span>
          </button>

          <button
            type="button"
            onClick={() => void handleRoleNav('/admin', 'NV00053', '🛡️ Quản Trị Admin')}
            className={pillCls(isAdminActive)}
          >
            <Shield className="h-3.5 w-3.5 text-sky-400" />
            <span>Quản Trị Admin</span>
          </button>

          <button
            type="button"
            onClick={() => void handleRoleNav('/andon', undefined, '📺 TV Andon 55"')}
            className={pillCls(isAndon)}
          >
            <MonitorPlay className="h-3.5 w-3.5 text-purple-400" />
            <span>TV Andon 55&quot;</span>
          </button>

          <button
            type="button"
            onClick={() =>
              void handleRoleNav('/print/traveler/PO485-01', undefined, '🖨️ Phiếu Công Nghệ QR')
            }
            className={pillCls(isPrintActive)}
          >
            <Printer className="h-3.5 w-3.5 text-slate-300" />
            <span>Phiếu QR</span>
          </button>
        </nav>

        {/* Active User & PIN / Outbox Status */}
        <div className="flex flex-wrap items-center gap-1.5">
          {outboxCount > 0 && (
            <button
              type="button"
              onClick={() => void flushOfflineOutbox()}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-200"
              title="Đồng bộ phiếu lưu ngoại tuyến"
            >
              <CloudOff className="h-3.5 w-3.5" />
              <span className="font-mono-num">{outboxCount}</span> chờ đồng bộ
            </button>
          )}

          {user ? (
            <Badge
              variant={
                user.appRole === 'ADMIN' || user.appRole === 'DIRECTOR'
                  ? 'info'
                  : user.appRole === 'QC' || user.appRole === 'SHIFT_LEADER'
                    ? 'warning'
                    : 'success'
              }
              className="max-w-[200px] truncate py-1"
            >
              <span className="truncate">
                {user.name} ({user.workerId})
              </span>
            </Badge>
          ) : (
            <Badge variant="neutral">Chưa đăng nhập</Badge>
          )}

          <button
            type="button"
            onClick={() => openPinModal(user?.workerId)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-industrial-border bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-sky-400 hover:text-sky-300"
          >
            <KeyRound className="h-3.5 w-3.5 text-sky-400" />
            <span>Đổi PIN / TK</span>
          </button>

          {isAndon && (
            <button
              type="button"
              onClick={() => setCollapsedKiosk(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-industrial-border bg-slate-900 text-slate-300 hover:text-white"
              title="Thu gọn thanh trên TV Kiosk"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
