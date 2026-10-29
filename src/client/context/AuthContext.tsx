import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Delete, Lock, ShieldCheck } from 'lucide-react';
import type {
  AuthMode,
  AuthSessionResponse,
  AuthSessionUser,
  QuickSwitchProfile,
} from '@shared/types';
import { apiClient, setStoredAuthToken } from '../lib/apiClient';
import { getFallbackUser } from '../lib/clientFallbackStore';
import { Button, Modal, useToast } from '../components/ui/IndustrialPrimitives';

interface AuthContextValue {
  user: AuthSessionUser | null;
  authMode: AuthMode;
  loading: boolean;
  quickSwitchProfiles: QuickSwitchProfile[];
  loginWithPin: (workerIdOrUsername: string, pin: string) => Promise<AuthSessionUser>;
  quickSwitch: (params: { workerId?: string; role?: string }) => Promise<AuthSessionUser | null>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  openPinModal: (preselectedWorkerId?: string) => void;
  closePinModal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('DEMO_QUICK');
  const [quickSwitchProfiles, setQuickSwitchProfiles] = useState<QuickSwitchProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pinModalOpen, setPinModalOpen] = useState<boolean>(false);
  const [preselectedId, setPreselectedId] = useState<string>('');
  const toast = useToast();

  const quickSwitch = useCallback(
    async (params: { workerId?: string; role?: string }): Promise<AuthSessionUser | null> => {
      try {
        const res = await apiClient.post<{
          token: string;
          user: AuthSessionUser;
          authMode: AuthMode;
        }>('/auth/quick-switch', params);
        if (res.token) setStoredAuthToken(res.token);
        setUser(res.user);
        setAuthMode(res.authMode);
        return res.user;
      } catch (err) {
        console.warn('apiClient quick-switch error, using local fallback:', err);
        const targetId = params.workerId || (params.role === 'ADMIN' ? 'NV00053' : 'NV_KT02');
        const fallbackUser = getFallbackUser(targetId);
        setUser(fallbackUser);
        setAuthMode('DEMO_QUICK');
        return fallbackUser;
      }
    },
    []
  );

  const refreshSession = useCallback(async () => {
    try {
      const sess = await apiClient.get<AuthSessionResponse>('/auth/session');
      setAuthMode(sess.authMode);
      setQuickSwitchProfiles(sess.quickSwitchProfiles || []);

      if (sess.user) {
        setUser(sess.user);
      } else if (sess.authMode === 'DEMO_QUICK') {
        const path =
          typeof window !== 'undefined'
            ? window.location.hash && window.location.hash.startsWith('#/')
              ? window.location.hash.slice(1)
              : window.location.pathname
            : '/worker';
        if (path.startsWith('/admin')) {
          const targetId =
            path.includes('logs_qc') || path.includes('daily_schedule') ? 'NV_KT02' : 'NV00053';
          await quickSwitch({ workerId: targetId });
        } else if (!path.startsWith('/andon')) {
          await quickSwitch({ workerId: 'NV00214' });
        }
      } else {
        setUser(null);
      }
    } catch {
      // Offline fallback keeps UI usable
      setAuthMode('DEMO_QUICK');
      const path =
        typeof window !== 'undefined'
          ? window.location.hash && window.location.hash.startsWith('#/')
            ? window.location.hash.slice(1)
            : window.location.pathname
          : '/worker';
      if (path.startsWith('/admin')) {
        const targetId =
          path.includes('logs_qc') || path.includes('daily_schedule') ? 'NV_KT02' : 'NV00053';
        await quickSwitch({ workerId: targetId });
      } else {
        await quickSwitch({ workerId: 'NV00214' });
      }
    } finally {
      setLoading(false);
    }
  }, [quickSwitch]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const loginWithPin = useCallback(
    async (workerIdOrUsername: string, pin: string): Promise<AuthSessionUser> => {
      const res = await apiClient.post<{
        token: string;
        user: AuthSessionUser;
        authMode: AuthMode;
      }>('/auth/login', {
        workerId: workerIdOrUsername,
        pin,
      });
      if (res.token) setStoredAuthToken(res.token);
      setUser(res.user);
      setAuthMode(res.authMode);
      setPinModalOpen(false);
      toast.success(`Xin chào ${res.user.name} (${res.user.title})`);
      return res.user;
    },
    [toast]
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // ignore
    }
    setStoredAuthToken(null);
    setUser(null);
    toast.info('Đã đăng xuất phiên làm việc.');
  }, [toast]);

  const openPinModal = useCallback(
    (workerId?: string) => {
      setPreselectedId(workerId || user?.workerId || 'NV00214');
      setPinModalOpen(true);
    },
    [user?.workerId]
  );

  const closePinModal = useCallback(() => setPinModalOpen(false), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authMode,
        loading,
        quickSwitchProfiles,
        loginWithPin,
        quickSwitch,
        logout,
        refreshSession,
        openPinModal,
        closePinModal,
      }}
    >
      {children}
      <PinLoginModal
        open={pinModalOpen}
        onClose={closePinModal}
        initialWorkerId={preselectedId}
        profiles={quickSwitchProfiles}
        onSubmit={loginWithPin}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

// ==================== 56PX BRIGHT POS / BANKING PIN LOGIN MODAL ====================
interface PinLoginModalProps {
  open: boolean;
  onClose: () => void;
  initialWorkerId: string;
  profiles: QuickSwitchProfile[];
  onSubmit: (workerId: string, pin: string) => Promise<AuthSessionUser>;
}

export function PinLoginModal({
  open,
  onClose,
  initialWorkerId,
  profiles,
  onSubmit,
}: PinLoginModalProps) {
  const [workerId, setWorkerId] = useState(initialWorkerId || 'NV00214');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (open) {
      setWorkerId(initialWorkerId || 'NV00214');
      setPin('');
      setErrMsg('');
    }
  }, [open, initialWorkerId]);

  const appendDigit = (d: string) => {
    setErrMsg('');
    setPin((prev) => (prev.length < 12 ? prev + d : prev));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!workerId.trim() || !pin.trim()) {
      setErrMsg('Vui lòng nhập Mã nhân viên và mã PIN.');
      return;
    }
    setSubmitting(true);
    setErrMsg('');
    try {
      await onSubmit(workerId.trim(), pin.trim());
    } catch (err: any) {
      setErrMsg(err?.message || 'Đăng nhập thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const dotSlots = Math.max(4, Math.min(8, pin.length));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xác Thực Phiên Vận Hành & Quản Trị"
      subtitle="Phiên đăng nhập được ghi nhớ an toàn 30 ngày trên thiết bị này"
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Mã nhân viên / Tài khoản
          </label>
          {profiles.length > 0 ? (
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            >
              {profiles.map((p) => (
                <option key={p.workerId} value={p.workerId}>
                  {p.workerId} — {p.name} ({p.title})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              placeholder="VD: NV00214 hoặc NV00053"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
          )}
        </div>

        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600">
            <span>Mã PIN cá nhân</span>
            <span className="text-[11px] font-medium normal-case tracking-normal text-slate-500">
              Mặc định CN: 1234 | QĐ: admin123
            </span>
          </label>

          {/* Banking/POS PIN Dots Indicator */}
          <div
            aria-hidden="true"
            className="mb-2 flex items-center justify-center gap-2.5 py-1"
          >
            {Array.from({ length: dotSlots }).map((_, idx) => {
              const filled = idx < pin.length;
              return (
                <span
                  key={idx}
                  className={`h-3 w-3 rounded-full transition-all ${filled ? 'scale-110 bg-blue-600 shadow-sm' : 'bg-slate-200'
                    }`}
                />
              );
            })}
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setErrMsg('');
                setPin(e.target.value);
              }}
              placeholder="Nhập mã PIN..."
              className="font-mono-num min-h-[50px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-center text-xl font-bold tracking-[0.25em] text-slate-900 shadow-sm placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
          </div>
        </div>

        {/* 56px Shopfloor Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {keypadDigits.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => appendDigit(d)}
              className="font-mono-num flex h-14 min-h-[56px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xl font-bold text-slate-900 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="flex h-14 min-h-[56px] items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-sm font-bold text-amber-800 transition-all hover:border-amber-300 hover:bg-amber-100 active:scale-95"
          >
            XÓA
          </button>
          <button
            type="button"
            onClick={() => appendDigit('0')}
            className="font-mono-num flex h-14 min-h-[56px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xl font-bold text-slate-900 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin((p) => p.slice(0, -1))}
            className="flex h-14 min-h-[56px] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-200 hover:text-slate-900 active:scale-95"
            aria-label="Xóa 1 ký tự"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {errMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
            {errMsg}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="touch"
          disabled={submitting}
          className="w-full"
        >
          <ShieldCheck className="h-5 w-5" />
          {submitting ? 'ĐANG XÁC THỰC...' : 'MỞ KHÓA CA LÀM VIỆC'}
        </Button>
      </form>
    </Modal>
  );
}
