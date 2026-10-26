import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { matchesSearch } from '@shared/vnSearch';

export interface PickerOptionItem {
  id: string;
  primaryText: string;
  secondaryText?: string;
  metaBadge?: string;
  metaVariant?: 'emerald' | 'sky' | 'amber' | 'red' | 'purple' | 'slate';
  rightText?: string;
  searchKeywords?: string;
}

export interface SearchablePickerSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  options: PickerOptionItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  emptyMessage?: string;
}

const INITIAL_RENDER_LIMIT = 80;

export function SearchablePickerSheet({
  open,
  onClose,
  title,
  subtitle,
  searchPlaceholder = 'Gõ tên chi tiết, mã số (không dấu, ký hiệu Φ, ")...',
  options,
  selectedId,
  onSelect,
  emptyMessage = 'Không tìm thấy mục phù hợp với từ khóa.',
}: SearchablePickerSheetProps) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setShowAll(false);
    const timer = window.setTimeout(() => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        inputRef.current?.focus();
      }
    }, 60);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    return options.filter((item) => {
      const hay = `${item.id} ${item.primaryText} ${item.secondaryText || ''} ${item.metaBadge || ''} ${item.searchKeywords || ''}`;
      return matchesSearch(hay, query);
    });
  }, [options, query]);

  const visibleItems = useMemo(() => {
    if (showAll || filtered.length <= INITIAL_RENDER_LIMIT) return filtered;
    return filtered.slice(0, INITIAL_RENDER_LIMIT);
  }, [filtered, showAll]);

  if (!open) return null;

  const badgeTone: Record<NonNullable<PickerOptionItem['metaVariant']>, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    sky: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
    purple: 'border-violet-200 bg-violet-50 text-violet-700',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
  };

  return (
    <div
      className="no-print fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white text-slate-900 shadow-elevated sm:h-[82vh] sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-extrabold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Đóng danh sách chọn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sticky Search Box */}
        <div className="border-b border-slate-200 bg-white px-3.5 py-2.5">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-blue-600" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowAll(false);
              }}
              placeholder={searchPlaceholder}
              className="min-h-[50px] w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-11 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
                aria-label="Xóa từ khóa"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>Hỗ trợ gõ tiếng Việt không dấu &amp; ký hiệu bản vẽ (&quot;, Φ, #)</span>
            <span className="font-mono-num font-bold text-blue-700">
              {filtered.length} / {options.length} mục
            </span>
          </div>
        </div>

        {/* Scrollable Multi-line List */}
        <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50/40 p-3">
          {visibleItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
              {emptyMessage}
            </div>
          ) : (
            visibleItems.map((item) => {
              const active = item.id === selectedId;
              const tone = badgeTone[item.metaVariant || 'slate'];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  className={`flex min-h-[56px] w-full min-w-0 items-start justify-between gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.99] ${
                    active
                      ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/30'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.metaBadge && (
                        <span
                          className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 font-mono-num text-[11px] font-bold ${tone}`}
                        >
                          {item.metaBadge}
                        </span>
                      )}
                      {item.rightText && (
                        <span className="font-mono-num text-xs font-semibold text-blue-700">
                          {item.rightText}
                        </span>
                      )}
                    </div>
                    <div className="break-words text-sm font-bold leading-snug text-slate-900">
                      {item.primaryText}
                    </div>
                    {item.secondaryText && (
                      <div className="break-words text-xs leading-relaxed text-slate-600">
                        {item.secondaryText}
                      </div>
                    )}
                  </div>

                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-slate-50 text-transparent'
                    }`}
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                  </div>
                </button>
              );
            })
          )}

          {!showAll && filtered.length > INITIAL_RENDER_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="min-h-[48px] w-full rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
            >
              Hiển thị toàn bộ {filtered.length} mục (+{filtered.length - INITIAL_RENDER_LIMIT} mục còn lại)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchablePickerSheet;
