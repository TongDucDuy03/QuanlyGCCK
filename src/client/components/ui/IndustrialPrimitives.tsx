import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, X, XCircle } from 'lucide-react';

// ==================== TOAST SYSTEM ====================
export type ToastKind = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev.slice(-4), { id, kind, message }]);
      window.setTimeout(() => removeToast(id), 4200);
    },
    [removeToast]
  );

  const value: ToastContextValue = {
    showToast,
    success: (m) => showToast(m, 'success'),
    error: (m) => showToast(m, 'error'),
    warning: (m) => showToast(m, 'warning'),
    info: (m) => showToast(m, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print fixed bottom-20 sm:bottom-4 right-4 z-[90] flex max-w-md flex-col gap-2 pointer-events-none px-3 sm:px-0">
        {toasts.map((t) => {
          const styles: Record<ToastKind, string> = {
            success: 'border-emerald-500/60 bg-slate-900/95 text-emerald-100',
            error: 'border-red-500/70 bg-slate-900/95 text-red-100',
            warning: 'border-amber-500/70 bg-slate-900/95 text-amber-100',
            info: 'border-sky-500/60 bg-slate-900/95 text-sky-100',
          };
          const Icon =
            t.kind === 'success'
              ? CheckCircle2
              : t.kind === 'error'
                ? XCircle
                : t.kind === 'warning'
                  ? AlertTriangle
                  : Info;

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-2xl backdrop-blur-md transition-all ${styles[t.kind]}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1 text-sm font-medium leading-snug">{t.message}</div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Đóng thông báo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return ctx;
}

// ==================== CARD ====================
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noPadding?: boolean;
}

export function Card({
  children,
  className = '',
  elevated = false,
  noPadding = false,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-industrial-border ${
        elevated ? 'bg-industrial-elevated' : 'bg-industrial-surface'
      } ${noPadding ? '' : 'p-4'} shadow-lg ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// ==================== BADGE ====================
export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ children, variant = 'neutral', className = '', ...rest }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    neutral: 'border-slate-600/60 bg-slate-800/80 text-slate-200',
    info: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
    success: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    warning: 'border-amber-500/45 bg-amber-500/15 text-amber-300',
    danger: 'border-red-500/50 bg-red-500/20 text-red-300',
    purple: 'border-purple-500/45 bg-purple-500/15 text-purple-300',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold tracking-tight ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

// ==================== BUTTON ====================
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'touch';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-sky-500 text-slate-950 hover:bg-sky-400 active:bg-sky-300 border border-sky-400/50 font-bold shadow-sm',
    secondary:
      'bg-industrial-elevated text-slate-100 hover:bg-slate-700/80 border border-industrial-border font-semibold',
    success:
      'bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:bg-emerald-300 border border-emerald-400/50 font-bold shadow-sm',
    warning:
      'bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-300 border border-amber-400/50 font-bold shadow-sm',
    danger:
      'bg-red-600 text-white hover:bg-red-500 active:bg-red-400 border border-red-400/40 font-bold shadow-sm',
    ghost:
      'bg-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent font-medium',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'min-h-[34px] px-2.5 py-1 text-xs rounded-lg',
    md: 'min-h-[40px] px-3.5 py-2 text-sm rounded-lg',
    lg: 'min-h-[48px] px-4 py-2.5 text-base rounded-xl',
    touch: 'min-h-[52px] px-4 py-3 text-base rounded-xl',
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ==================== MODAL ====================
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full ${maxWidthClass} flex-col rounded-t-2xl sm:rounded-2xl border border-industrial-border bg-industrial-surface shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-industrial-border px-4 py-3.5">
          <div>
            <h3 className="text-base font-bold text-slate-50">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-industrial-border bg-industrial-elevated text-slate-300 hover:bg-slate-700 hover:text-white"
            aria-label="Đóng hộp thoại"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-industrial-border px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== PAGINATION BAR ====================
export interface PaginationBarProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function PaginationBar({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-industrial-border px-3 py-2.5 text-xs text-slate-300">
      <div className="flex items-center gap-2">
        <span>
          Hiển thị <strong className="font-mono-num text-slate-100">{startIdx}</strong>–
          <strong className="font-mono-num text-slate-100">{endIdx}</strong> / Tổng{' '}
          <strong className="font-mono-num text-sky-300">{totalItems}</strong> bản ghi
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-industrial-border bg-industrial-elevated px-2 py-1 text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / trang
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-industrial-border bg-industrial-elevated px-2.5 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Trước
        </button>
        <span className="px-2 font-mono-num font-semibold text-slate-200">
          Trang {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-industrial-border bg-industrial-elevated px-2.5 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          Sau <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
