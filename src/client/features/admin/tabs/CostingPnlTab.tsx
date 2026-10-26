import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  Calculator,
  CheckCircle2,
  Coins,
  Download,
  Eye,
  Save,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ProductCostingSummary } from '@shared/types';
import { matchesSearch } from '@shared/vnSearch';
import { apiClient } from '@client/lib/apiClient';
import { downloadCostingPnlExcel } from '@client/lib/excelService';
import { formatCompactVnd, formatNumber, formatVnd } from '@client/lib/formatters';
import {
  Badge,
  Button,
  Card,
  Modal,
  PaginationBar,
  useToast,
} from '@client/components/ui/IndustrialPrimitives';
import type { AdminTabCommonProps } from '../types';

type CostingFilterMode = 'ALL' | 'ACTUAL' | 'LOSS' | 'PROFIT' | 'WIP_ONLY';

interface CostingApiResponse {
  items: ProductCostingSummary[];
  summary: {
    totalProducts: number;
    profitCount: number;
    lossCount: number;
    totalNetProfit: number;
  };
}

export function CostingPnlTab({
  onRefreshBootstrap,
  deepLink,
}: AdminTabCommonProps) {
  const toast = useToast();

  const [items, setItems] = useState<ProductCostingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(deepLink?.costingSearch || '');
  const [filterMode, setFilterMode] = useState<CostingFilterMode>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);

  // Inline quote edits map: spId -> number
  const [inlineQuotes, setInlineQuotes] = useState<Record<string, string>>({});
  const [savingSpId, setSavingSpId] = useState<string | null>(null);

  // Detailed Costing & Pricing Drawer/Modal
  const [detailItem, setDetailItem] = useState<ProductCostingSummary | null>(null);
  const [modalQuotedPrice, setModalQuotedPrice] = useState(0);
  const [modalRawMatCost, setModalRawMatCost] = useState(0);
  const [modalOutsourceCost, setModalOutsourceCost] = useState(0);
  const [savingModal, setSavingModal] = useState(false);

  useEffect(() => {
    if (deepLink?.costingSearch !== undefined) {
      setSearchQuery(deepLink.costingSearch);
      setPage(1);
    }
  }, [deepLink?.costingSearch]);

  const fetchCosting = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<CostingApiResponse>('/costing');
      setItems(res.items || []);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải dữ liệu Báo giá & Lãi/Lỗ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCosting();
  }, []);

  const summary = useMemo(() => {
    const totalProducts = items.length;
    let profitCount = 0;
    let lossCount = 0;
    let totalNetProfit = 0;
    let wipOnlyCount = 0;

    for (const c of items) {
      if (c.unitProfit < 0) lossCount++;
      else profitCount++;
      if (c.hasActual) totalNetProfit += c.totalBatchProfit;
      if (!c.hasActual && c.wipQty > 0) wipOnlyCount++;
    }

    return {
      totalProducts,
      profitCount,
      lossCount,
      totalNetProfit,
      wipOnlyCount,
      actualCount: items.filter((i) => i.hasActual).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const list = items.filter((c) => {
      if (filterMode === 'ACTUAL' && !c.hasActual) return false;
      if (filterMode === 'LOSS' && c.unitProfit >= 0) return false;
      if (filterMode === 'PROFIT' && c.unitProfit < 0) return false;
      if (filterMode === 'WIP_ONLY' && (c.hasActual || c.wipQty <= 0)) return false;

      if (!searchQuery.trim()) return true;
      return matchesSearch(
        `${c.spId} ${c.customer} ${c.productName} ${c.opsSummary}`,
        searchQuery
      );
    });

    return list.sort((a, b) => {
      const aScore = a.hasActual ? 2 : a.wipQty > 0 ? 1 : 0;
      const bScore = b.hasActual ? 2 : b.wipQty > 0 ? 1 : 0;
      if (bScore !== aScore) return bScore - aScore;
      return a.spId.localeCompare(b.spId, 'en', { numeric: true });
    });
  }, [items, filterMode, searchQuery]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const handleInlineSaveQuote = async (c: ProductCostingSummary) => {
    const rawStr = inlineQuotes[c.spId];
    const nextPrice = rawStr !== undefined ? Math.max(0, Number(rawStr) || 0) : c.quotedPrice;
    setSavingSpId(c.spId);
    try {
      const res = await apiClient.patch<{ success: boolean; item: ProductCostingSummary }>(
        `/costing/${encodeURIComponent(c.spId)}`,
        { quotedPrice: nextPrice }
      );
      if (res.item) {
        setItems((prev) => prev.map((it) => (it.spId === c.spId ? res.item : it)));
      }
      toast.success(`Đã lưu đơn giá báo khách cho [${c.spId}] ${c.productName}.`);
      await onRefreshBootstrap();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi lưu báo giá sản phẩm.');
    } finally {
      setSavingSpId(null);
    }
  };

  const openDetailModal = (c: ProductCostingSummary) => {
    setDetailItem(c);
    const pendingInline = inlineQuotes[c.spId];
    setModalQuotedPrice(
      pendingInline !== undefined ? Math.max(0, Number(pendingInline) || 0) : c.quotedPrice
    );
    setModalRawMatCost(c.rawMaterialCost);
    setModalOutsourceCost(c.outsourceCost);
  };

  const handleSaveDetailModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailItem) return;
    setSavingModal(true);
    try {
      const res = await apiClient.patch<{ success: boolean; item: ProductCostingSummary }>(
        `/costing/${encodeURIComponent(detailItem.spId)}`,
        {
          quotedPrice: modalQuotedPrice,
          rawMaterialCost: modalRawMatCost,
          outsourceCost: modalOutsourceCost,
        }
      );
      if (res.item) {
        setItems((prev) => prev.map((it) => (it.spId === detailItem.spId ? res.item : it)));
        setDetailItem(res.item);
        setInlineQuotes((prev) => {
          const copy = { ...prev };
          delete copy[detailItem.spId];
          return copy;
        });
      }
      toast.success(
        `Đã cập nhật Báo giá, Chi phí Phôi & Gia công ngoài cho [${detailItem.spId}].`
      );
      await onRefreshBootstrap();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu định giá chi tiết.');
    } finally {
      setSavingModal(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await downloadCostingPnlExcel(items);
      toast.success(`Đã xuất Excel 19 cột Báo Giá & Đối Soát Lãi/Lỗ (${items.length} SP).`);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xuất file Excel Báo giá.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ==================== 4 P&L SUMMARY CARDS ==================== */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-sky-500/35">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tổng Mã Thành Phẩm (Gộp NC)
              </div>
              <div className="font-mono-num mt-1.5 text-3xl font-extrabold text-sky-300">
                {formatNumber(summary.totalProducts)} <span className="text-sm">SP</span>
              </div>
              <div className="mt-1.5 text-xs text-slate-400">
                Đã có SX hoàn chỉnh: <strong className="text-slate-200">{summary.actualCount}</strong>{' '}
                | Đang WIP: <strong className="text-amber-300">{summary.wipOnlyCount}</strong>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-300">
              <Calculator className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="border-emerald-500/35">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Số Mã Đang Lãi Tốt
              </div>
              <div className="font-mono-num mt-1.5 text-3xl font-extrabold text-emerald-400">
                {formatNumber(summary.profitCount)} <span className="text-sm">SP</span>
              </div>
              <div className="mt-1.5 text-xs text-emerald-300/80">
                Đơn giá báo khách ≥ Giá thành
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="border-red-500/35">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Số Mã Cảnh Báo Lỗ
              </div>
              <div className="font-mono-num mt-1.5 text-3xl font-extrabold text-red-400">
                {formatNumber(summary.lossCount)} <span className="text-sm">SP</span>
              </div>
              <div className="mt-1.5 text-xs text-red-300/80">
                Cần rà soát định mức hoặc đàm phán giá
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/15 text-red-300">
              <TrendingDown className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="border-amber-500/40 bg-gradient-to-br from-slate-900 to-amber-950/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tổng Lợi Nhuận Ròng Thực Tế
              </div>
              <div className="font-mono-num mt-1.5 text-2xl font-extrabold text-amber-300">
                {formatVnd(summary.totalNetProfit)}
              </div>
              <div className="mt-1.5 text-xs text-slate-400">
                ({formatCompactVnd(summary.totalNetProfit)}) • Khử 100% lãi ảo bán TP
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-300">
              <Coins className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* ==================== MAIN COSTING TABLE ==================== */}
      <Card noPadding>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-industrial-border p-4">
          <div>
            <h2 className="text-base font-extrabold uppercase tracking-wide text-emerald-300">
              💰 Bảng Báo Giá Thành Phẩm &amp; Đối Soát Giá Vốn Định Mức vs Giá Thành Thực Tế (
              {items.length} SP)
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Cơ chế <strong>Chống Lãi Ảo</strong>: chỉ ghi nhận thành phẩm khi hoàn tất công đoạn
              Cuối (<code>isFinalOp = 1</code>); bước chưa log tự động bù giá vốn ĐM.
            </p>
          </div>
          <Button
            variant="success"
            size="sm"
            disabled={exporting || items.length === 0}
            onClick={() => void handleExportExcel()}
          >
            <Download className="h-4 w-4" />
            📥 Xuất Excel Báo Giá &amp; Đối Soát Lãi/Lỗ (19 cột)
          </Button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-industrial-border bg-slate-950/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['ALL', `Tất cả (${summary.totalProducts})`],
                ['ACTUAL', `🔥 ACTUAL - Đã có SX thực tế (${summary.actualCount})`],
                ['LOSS', `🔴 LOSS - Đang bị Lỗ (${summary.lossCount})`],
                ['PROFIT', `🟢 PROFIT - Đang có Lãi (${summary.profitCount})`],
                ['WIP_ONLY', `⏳ Đang dở dang WIP (${summary.wipOnlyCount})`],
              ] as Array<[CostingFilterMode, string]>
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setFilterMode(k);
                  setPage(1);
                }}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                  filterMode === k
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-industrial-border bg-industrial-elevated text-slate-300 hover:border-slate-500'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Gõ Mã SP (VD: SP095), Tên SP, Khách hàng không dấu..."
              className="h-9 w-full rounded-lg border border-industrial-border bg-industrial-elevated pl-9 pr-3 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-[580px] overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Đang tính toán giá vốn định mức &amp; giá thành thực tế 334+ sản phẩm...
            </div>
          ) : (
            <table className="w-full min-w-[1250px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] font-bold uppercase tracking-wider text-slate-400 shadow">
                <tr className="border-b border-industrial-border">
                  <th className="px-3 py-2.5">Mã SP</th>
                  <th className="px-3 py-2.5">Khách Hàng</th>
                  <th className="px-3 py-2.5">Thành Phẩm &amp; Quy Trình Công Nghệ</th>
                  <th className="px-2.5 py-2.5 text-center">Tổng ĐM</th>
                  <th className="px-3 py-2.5 text-right">
                    Giá Vốn ĐM / 1 SP
                    <div className="text-[10px] font-normal text-slate-500">
                      (Lương+Máy+Dao+10%+Phôi)
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    Giá Thực Tế &amp; SL Xong
                    <div className="text-[10px] font-normal text-slate-500">
                      (Chỉ tính bước End)
                    </div>
                  </th>
                  <th className="w-[215px] px-3 py-2.5 text-center">
                    Đơn Giá Báo Khách
                    <div className="text-[10px] font-normal text-sky-400">
                      (Sửa nhanh + Phôi/GCN)
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-right">Lãi / Lỗ (/1 SP)</th>
                  <th className="px-3 py-2.5 text-center">Kết Luận P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-border/60">
                {pagedItems.map((c) => {
                  const isLoss = c.unitProfit < 0;
                  const quoteVal =
                    inlineQuotes[c.spId] !== undefined
                      ? inlineQuotes[c.spId]
                      : String(c.quotedPrice);

                  return (
                    <tr
                      key={c.spId}
                      className={`hover:bg-slate-800/40 ${isLoss ? 'bg-red-950/10' : ''}`}
                    >
                      <td className="font-mono-num px-3 py-2.5 font-extrabold text-slate-300">
                        {c.spId}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-200">{c.customer}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => openDetailModal(c)}
                          className="text-left font-bold text-sky-300 hover:underline"
                        >
                          {c.productName}
                        </button>
                        <div className="mt-0.5 max-w-[300px] truncate text-[11px] text-slate-400">
                          {c.opCount} NC: {c.opsSummary}
                        </div>
                        {(c.rawMaterialCost > 0 || c.outsourceCost > 0) && (
                          <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                            {c.rawMaterialCost > 0 && (
                              <Badge variant="neutral">Phôi: {formatVnd(c.rawMaterialCost)}</Badge>
                            )}
                            {c.outsourceCost > 0 && (
                              <Badge variant="purple">GCN: {formatVnd(c.outsourceCost)}</Badge>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="font-mono-num px-2.5 py-2.5 text-center">
                        <div className="font-bold text-slate-100">{formatNumber(c.totalSec)}s</div>
                        <div className="text-[11px] text-slate-400">({c.totalHours}h)</div>
                      </td>

                      <td className="font-mono-num px-3 py-2.5 text-right">
                        <div className="font-bold text-slate-100">
                          {formatVnd(c.totalStdCost)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          NC:{Math.round(c.stdLabor / 1000)}k | M:{Math.round(c.stdMach / 1000)}k |
                          D:{Math.round(c.stdTool / 1000)}k
                        </div>
                      </td>

                      <td className="font-mono-num px-3 py-2.5 text-right">
                        {c.hasActual ? (
                          <>
                            <div className="font-bold text-amber-300">
                              {formatVnd(c.actualUnitCost)}
                            </div>
                            <div className="text-[11px] font-semibold text-emerald-400">
                              Đã xong: {c.finishedQty} SP
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-slate-400">{formatVnd(c.totalStdCost)}</div>
                            {c.wipQty > 0 ? (
                              <div className="text-[10px] font-bold text-amber-300">
                                Đang WIP: {c.wipQty} (Xong: 0 SP)
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500">Theo ĐM (0 SP)</div>
                            )}
                          </>
                        )}
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            value={quoteVal}
                            onChange={(e) =>
                              setInlineQuotes((prev) => ({
                                ...prev,
                                [c.spId]: e.target.value,
                              }))
                            }
                            aria-label={`Đơn giá báo khách ${c.spId}`}
                            className="font-mono-num h-8 w-full rounded-lg border border-industrial-border bg-slate-950 px-2 text-right text-xs font-bold text-amber-300 focus:border-sky-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={savingSpId === c.spId}
                            onClick={() => void handleInlineSaveQuote(c)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/50 bg-sky-500/20 text-sky-300 hover:bg-sky-500/35"
                            title="Lưu nhanh đơn giá báo khách"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDetailModal(c)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-industrial-border bg-industrial-elevated text-slate-300 hover:border-emerald-400 hover:text-emerald-300"
                            title="Cập nhật Chi phí Phôi, Gia công ngoài & Bóc tách từng NC"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="font-mono-num px-3 py-2.5 text-right">
                        <div
                          className={`font-extrabold ${
                            isLoss ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {c.unitProfit > 0 ? '+' : ''}
                          {formatVnd(c.unitProfit)}
                        </div>
                        {c.hasActual && (
                          <div
                            className={`text-[10px] ${
                              isLoss ? 'text-red-300' : 'text-emerald-300'
                            }`}
                          >
                            Lô: {c.totalBatchProfit > 0 ? '+' : ''}
                            {formatVnd(c.totalBatchProfit)}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        {isLoss ? (
                          <Badge variant="danger">🔴 LỖ ({c.marginPct}%)</Badge>
                        ) : c.marginPct < 10 ? (
                          <Badge variant="warning">🟡 LÃI MỎNG ({c.marginPct}%)</Badge>
                        ) : (
                          <Badge variant="success">🟢 LÃI TỐT (+{c.marginPct}%)</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <PaginationBar
          totalItems={filteredItems.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
        />
      </Card>

      {/* ==================== MODAL: FULL COSTING BREAKDOWN + PHÔI / GCN ==================== */}
      <Modal
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        title={`📊 Bóc Tách Giá Thành & Định Giá SP: [${detailItem?.spId || ''}] ${
          detailItem?.productName || ''
        }`}
        subtitle={`Khách hàng: ${detailItem?.customer || ''} • Tổng ${
          detailItem?.opCount || 0
        } công đoạn`}
        maxWidthClass="max-w-3xl"
      >
        {detailItem && (
          <div className="space-y-4 text-xs">
            <form
              noValidate
              onSubmit={handleSaveDetailModal}
              className="rounded-xl border border-emerald-500/35 bg-emerald-950/15 p-3.5"
            >
              <div className="mb-2.5 font-extrabold uppercase tracking-wider text-emerald-300">
                1. Cập Nhật Báo Giá Khách Hàng, Chi Phí Phôi &amp; Gia Công Ngoài
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold text-amber-300">
                    💰 Đơn Giá Báo Khách / SP (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={modalQuotedPrice}
                    onChange={(e) => setModalQuotedPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="font-mono-num h-10 w-full rounded-xl border border-amber-500/50 bg-slate-950 px-3 text-sm font-extrabold text-amber-300"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-sky-300">
                    🧱 Chi Phí Phôi Đúc/Thép / SP (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={modalRawMatCost}
                    onChange={(e) => setModalRawMatCost(Math.max(0, Number(e.target.value) || 0))}
                    className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-slate-950 px-3 text-sm font-bold text-sky-300"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-purple-300">
                    🔥 Chi Phí Gia Công Ngoài (Nhiệt luyện / Mạ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={modalOutsourceCost}
                    onChange={(e) =>
                      setModalOutsourceCost(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-slate-950 px-3 text-sm font-bold text-purple-300"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-400">
                  Dự tính Giá vốn ĐM mới:{' '}
                  <strong className="font-mono-num text-slate-100">
                    {formatVnd(
                      detailItem.stdLabor +
                        detailItem.stdMach +
                        detailItem.stdTool +
                        detailItem.stdOverhead +
                        modalRawMatCost +
                        modalOutsourceCost
                    )}
                  </strong>
                </div>
                <Button type="submit" variant="success" size="sm" disabled={savingModal}>
                  <CheckCircle2 className="h-4 w-4" />
                  {savingModal ? 'Đang lưu...' : 'Lưu Định Giá & Chi Phí Phôi/GCN'}
                </Button>
              </div>
            </form>

            {/* Step-by-step Cost Breakdown */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-slate-300">
                  2. Bóc Tách Giá Thành Từng Bước Nguyên Công ({detailItem.stepBreakdowns.length}{' '}
                  bước)
                </span>
                <Badge variant={detailItem.hasActual ? 'success' : 'warning'}>
                  {detailItem.hasActual
                    ? `Thành phẩm hoàn tất: ${detailItem.finishedQty} SP`
                    : `WIP dở dang: ${detailItem.wipQty} SP • Thành phẩm: 0 SP`}
                </Badge>
              </div>

              <div className="overflow-x-auto rounded-xl border border-industrial-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-[11px] font-bold uppercase text-slate-400">
                    <tr className="border-b border-industrial-border">
                      <th className="px-3 py-2">Bước</th>
                      <th className="px-3 py-2">Mã NC &amp; Nguyên Công</th>
                      <th className="px-3 py-2 text-right">ĐM Giây</th>
                      <th className="px-3 py-2 text-right">Giá Vốn ĐM (+10%)</th>
                      <th className="px-3 py-2 text-center">SL Đã Ghi Nhận</th>
                      <th className="px-3 py-2 text-right">Đơn Giá Áp Dụng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-industrial-border/60">
                    {detailItem.stepBreakdowns.map((st) => (
                      <tr key={st.ncId}>
                        <td className="px-3 py-2">
                          <Badge variant={st.isFinalOp === 1 ? 'success' : 'neutral'}>
                            {st.isFinalOp === 1 ? `🏁 End (${st.stepOrder})` : `B${st.stepOrder}`}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-100">
                          <span className="font-mono-num mr-1.5 text-sky-400">{st.ncId}</span>
                          {st.opName}
                        </td>
                        <td className="font-mono-num px-3 py-2 text-right text-slate-300">
                          {formatNumber(st.stdSeconds)}s
                        </td>
                        <td className="font-mono-num px-3 py-2 text-right text-slate-200">
                          {formatVnd(st.stdOpUnitCost)}
                        </td>
                        <td className="font-mono-num px-3 py-2 text-center font-bold text-emerald-300">
                          {st.loggedOkQty} OK
                        </td>
                        <td className="font-mono-num px-3 py-2 text-right">
                          <span className="font-bold text-amber-300">
                            {formatVnd(st.effectiveUnitCost)}
                          </span>
                          {st.usedStdFallback && (
                            <span className="ml-1 text-[10px] text-slate-400">(Bù ĐM)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
