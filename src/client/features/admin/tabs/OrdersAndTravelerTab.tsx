import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  FileSearch,
  Package,
  Plus,
  Printer,
  QrCode,
  Search,
  Truck,
  Wrench,
} from 'lucide-react';
import type { DeliveryLogDto, PurchaseOrderInfo } from '@shared/types';
import { matchesSearch, normalizeVn, removeVietnameseTones } from '@shared/vnSearch';
import { apiClient } from '@client/lib/apiClient';
import { formatDateVn, formatNumber } from '@client/lib/formatters';
import { navigateTo } from '@client/lib/navigation';
import {
  Badge,
  Button,
  Card,
  Modal,
  PaginationBar,
  useToast,
} from '@client/components/ui/IndustrialPrimitives';
import type { AdminTabCommonProps } from '../types';

type PoFilterKey =
  | 'ALL'
  | 'OVERDUE'
  | 'IN_PROGRESS'
  | 'READY_SHIP'
  | 'DELIVERED'
  | 'NO_ROUTING';

export function OrdersAndTravelerTab({
  bootstrap,
  onRefreshBootstrap,
  onNavigateTab,
  deepLink,
}: AdminTabCommonProps) {
  const toast = useToast();

  const [orders, setOrders] = useState<PurchaseOrderInfo[]>(bootstrap.ordersList || []);
  const [deliveries, setDeliveries] = useState<DeliveryLogDto[]>([]);
  const [filterMode, setFilterMode] = useState<PoFilterKey>('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState(deepLink?.ordersSearch || '');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Create New PO Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [newPoId, setNewPoId] = useState('');
  const [newCustomer, setNewCustomer] = useState('Win-Win');
  const [customProductMode, setCustomProductMode] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newQtyPo, setNewQtyPo] = useState(20);
  const [newDueDate, setNewDueDate] = useState('2026-11-15');
  const [newMaterialLot, setNewMaterialLot] = useState('LOT-VICO-2610-088');
  const [newSupplierName, setNewSupplierName] = useState('Xưởng Đúc VICO Thắng Lợi');
  const [newCastDate, setNewCastDate] = useState(bootstrap.vietnamToday);
  const [newNote, setNewNote] = useState('');
  const [creatingPo, setCreatingPo] = useState(false);

  // Delivery Modal State
  const [deliverTargetPo, setDeliverTargetPo] = useState<PurchaseOrderInfo | null>(null);
  const [deliverQty, setDeliverQty] = useState(1);
  const [deliverNote, setDeliverNote] = useState('');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  // Edit PO Modal State
  const [editTargetPo, setEditTargetPo] = useState<PurchaseOrderInfo | null>(null);
  const [editQtyPo, setEditQtyPo] = useState(1);
  const [editDueDate, setEditDueDate] = useState('');
  const [editMaterialLot, setEditMaterialLot] = useState('');
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editPriority, setEditPriority] = useState(2);
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setOrders(bootstrap.ordersList || []);
  }, [bootstrap.ordersList]);

  useEffect(() => {
    if (deepLink?.ordersSearch !== undefined) {
      setSearchQuery(deepLink.ordersSearch);
      setPage(1);
    }
  }, [deepLink?.ordersSearch]);

  const loadOrdersAndDeliveries = async () => {
    try {
      const res = await apiClient.get<{
        items: PurchaseOrderInfo[];
        deliveries: DeliveryLogDto[];
      }>('/orders');
      setOrders(res.items || []);
      setDeliveries(res.deliveries || []);
    } catch {
      // Keep bootstrap fallback
    }
  };

  useEffect(() => {
    void loadOrdersAndDeliveries();
  }, []);

  // Build operation routing lookup by spId & compact productName
  const opCountMap = useMemo(() => {
    const bySp = new Map<string, number>();
    const byProd = new Map<string, number>();
    for (const op of bootstrap.operations) {
      if (op.spId) bySp.set(op.spId, (bySp.get(op.spId) || 0) + 1);
      const compact = normalizeVn(op.productName).replace(/\s+/g, '').toUpperCase();
      if (compact) byProd.set(compact, (byProd.get(compact) || 0) + 1);
    }
    return {
      getCount: (po: PurchaseOrderInfo) => {
        if (po.spId && bySp.has(po.spId)) return bySp.get(po.spId)!;
        const compact = normalizeVn(po.productName).replace(/\s+/g, '').toUpperCase();
        return byProd.get(compact) || 0;
      },
    };
  }, [bootstrap.operations]);

  const customersList = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.customer) set.add(o.customer);
    });
    bootstrap.products.forEach((p) => {
      if (p.customer) set.add(p.customer);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [orders, bootstrap.products]);

  const productsForSelectedCustomer = useMemo(() => {
    const filtered = bootstrap.products.filter(
      (p) => !newCustomer || p.customer === newCustomer
    );
    return filtered.length > 0 ? filtered : bootstrap.products;
  }, [bootstrap.products, newCustomer]);

  const classifyPoHelpers = (po: PurchaseOrderInfo) => {
    const statusAscii = removeVietnameseTones(po.status || '').toLowerCase();
    const isDelivered = po.remainQty <= 0 || statusAscii.includes('da giao du');
    const isOverdue = !isDelivered && po.dueDate < bootstrap.vietnamToday;
    const isReadyShip = !isDelivered && (po.stockQty > 0 || statusAscii.includes('cho giao'));
    const isInProgress =
      !isDelivered &&
      (statusAscii.includes('dang gia cong') ||
        (po.wipQty > 0 && po.finishedQty < po.qtyPo) ||
        (po.finishedQty > 0 && po.finishedQty < po.qtyPo));
    const opCount = opCountMap.getCount(po);
    const hasNoRouting = opCount === 0;
    return { isDelivered, isOverdue, isReadyShip, isInProgress, opCount, hasNoRouting };
  };

  const filterCounts = useMemo(() => {
    let overdue = 0;
    let inProgress = 0;
    let readyShip = 0;
    let delivered = 0;
    let noRouting = 0;
    for (const po of orders) {
      const c = classifyPoHelpers(po);
      if (c.isOverdue) overdue++;
      if (c.isInProgress) inProgress++;
      if (c.isReadyShip) readyShip++;
      if (c.isDelivered) delivered++;
      if (c.hasNoRouting) noRouting++;
    }
    return {
      all: orders.length,
      overdue,
      inProgress,
      readyShip,
      delivered,
      noRouting,
    };
  }, [orders, bootstrap.vietnamToday, opCountMap]);

  const filteredOrders = useMemo(() => {
    return orders.filter((po) => {
      if (customerFilter !== 'ALL' && po.customer !== customerFilter) return false;
      const c = classifyPoHelpers(po);
      if (filterMode === 'OVERDUE' && !c.isOverdue) return false;
      if (filterMode === 'IN_PROGRESS' && !c.isInProgress) return false;
      if (filterMode === 'READY_SHIP' && !c.isReadyShip) return false;
      if (filterMode === 'DELIVERED' && !c.isDelivered) return false;
      if (filterMode === 'NO_ROUTING' && !c.hasNoRouting) return false;

      if (!searchQuery.trim()) return true;
      return matchesSearch(
        `${po.poId} ${po.customer} ${po.productName} ${po.spId || ''} ${po.materialLot || ''} ${po.supplierName || ''} ${po.note || ''}`,
        searchQuery
      );
    });
  }, [orders, customerFilter, filterMode, searchQuery, bootstrap.vietnamToday, opCountMap]);

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  const openCreateModal = () => {
    const randSuffix = String(orders.length + 1).padStart(3, '0');
    setNewPoId(`PO2610-${randSuffix}`);
    const firstCust = customersList[0] || 'Win-Win';
    setNewCustomer(firstCust);
    const firstProd =
      bootstrap.products.find((p) => p.customer === firstCust)?.productName ||
      bootstrap.products[0]?.productName ||
      '';
    setNewProductName(firstProd);
    setCustomProductMode(false);
    setNewQtyPo(20);
    setNewMaterialLot(`LOT-VICO-${bootstrap.vietnamToday.replace(/-/g, '').slice(2)}-${randSuffix}`);
    setCreateOpen(true);
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoId.trim() || !newProductName.trim()) {
      toast.warning('Vui lòng nhập Mã PO và chọn hoặc nhập Tên Sản Phẩm.');
      return;
    }
    setCreatingPo(true);
    try {
      const matchedProd = bootstrap.products.find(
        (p) => p.productName === newProductName && (!newCustomer || p.customer === newCustomer)
      );
      await apiClient.post('/orders', {
        poId: newPoId.trim(),
        customer: newCustomer,
        spId: matchedProd?.spId || null,
        productName: newProductName.trim(),
        qtyPo: newQtyPo,
        dueDate: newDueDate,
        materialLot: newMaterialLot.trim(),
        supplierName: newSupplierName.trim(),
        castDate: newCastDate,
        note: newNote.trim(),
      });
      toast.success(`Đã tạo đơn hàng ${newPoId.trim()} thành công.`);
      setCreateOpen(false);
      setNewNote('');
      await loadOrdersAndDeliveries();
      await onRefreshBootstrap();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tạo đơn hàng PO mới.');
    } finally {
      setCreatingPo(false);
    }
  };

  const openDeliverModal = (po: PurchaseOrderInfo) => {
    setDeliverTargetPo(po);
    const defaultDeliver =
      po.stockQty > 0
        ? Math.min(po.stockQty, Math.max(1, po.remainQty))
        : Math.max(1, po.remainQty || 1);
    setDeliverQty(defaultDeliver);
    setDeliverNote(`Phiếu xuất kho giao hàng đợt ${
      deliveries.filter((d) => d.poId === po.poId).length + 1
    }`);
  };

  const handleRecordDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverTargetPo) return;
    if (deliverQty <= 0) {
      toast.warning('Số lượng xuất giao phải lớn hơn 0.');
      return;
    }
    setSubmittingDelivery(true);
    try {
      const res = await apiClient.post<{ message: string }>(
        `/orders/${encodeURIComponent(deliverTargetPo.poId)}/deliver`,
        {
          qtyDeliver: deliverQty,
          note: deliverNote.trim(),
        }
      );
      toast.success(res.message || `Đã xuất giao ${deliverQty} SP cho ${deliverTargetPo.poId}.`);
      setDeliverTargetPo(null);
      await loadOrdersAndDeliveries();
      await onRefreshBootstrap();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi ghi nhận xuất kho giao hàng.');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const openEditModal = (po: PurchaseOrderInfo) => {
    setEditTargetPo(po);
    setEditQtyPo(po.qtyPo);
    setEditDueDate(po.dueDate);
    setEditMaterialLot(po.materialLot || '');
    setEditSupplierName(po.supplierName || '');
    setEditPriority(po.priority ?? 2);
    setEditNote(po.note || '');
  };

  const handleSaveEditPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetPo) return;
    setSavingEdit(true);
    try {
      await apiClient.patch(`/orders/${encodeURIComponent(editTargetPo.poId)}`, {
        qtyPo: editQtyPo,
        dueDate: editDueDate,
        materialLot: editMaterialLot,
        supplierName: editSupplierName,
        priority: editPriority,
        note: editNote,
      });
      toast.success(`Đã cập nhật thông tin Lệnh SX ${editTargetPo.poId}.`);
      setEditTargetPo(null);
      await loadOrdersAndDeliveries();
      await onRefreshBootstrap();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật PO.');
    } finally {
      setSavingEdit(false);
    }
  };

  const targetPoDeliveries = useMemo(() => {
    if (!deliverTargetPo) return [];
    return deliveries.filter((d) => d.poId === deliverTargetPo.poId);
  }, [deliveries, deliverTargetPo]);

  return (
    <div className="space-y-4">
      <Card noPadding>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-industrial-border p-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-400" />
              <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-50">
                Quản Lý Đơn Hàng PO, Lô Phôi Đầu Vào, Xuất Giao Kho &amp; Phiếu Công Nghệ QR
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Hiển thị 100% toàn bộ <strong className="text-amber-300">{orders.length} PO</strong>{' '}
              (không cắt cụt 60 dòng). Đối soát SL Hoàn thành công đoạn Cuối vs SL Đã Xuất Giao Kho
              &amp; In Lệnh SX QR 1-Click.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="warning" size="md" onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Tạo Đơn Hàng / PO Mới
            </Button>
          </div>
        </div>

        {/* Smart Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-industrial-border bg-slate-950/60 px-4 py-2.5">
          {(
            [
              ['ALL', `Tất cả (${filterCounts.all})`],
              ['OVERDUE', `🔥 Trễ hạn (${filterCounts.overdue})`],
              ['IN_PROGRESS', `⚙️ Đang gia công (${filterCounts.inProgress})`],
              ['READY_SHIP', `📦 Xong CK - Chờ giao (${filterCounts.readyShip})`],
              ['DELIVERED', `✅ Đã giao đủ (${filterCounts.delivered})`],
              ['NO_ROUTING', `⚠️ Chưa có quy trình NC (${filterCounts.noRouting})`],
            ] as Array<[PoFilterKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilterMode(key);
                setPage(1);
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                filterMode === key
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-industrial-border bg-industrial-elevated text-slate-300 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search & Customer Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-industrial-border bg-slate-950/30 px-4 py-2.5">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Gõ Mã PO, Khách hàng, Tên bản vẽ SP (có hoặc không dấu), Mã lô phôi..."
              className="h-9 w-full rounded-lg border border-industrial-border bg-industrial-elevated pl-9 pr-3 text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
            />
          </div>

          <select
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-industrial-border bg-industrial-elevated px-3 text-xs font-semibold text-slate-200 focus:border-sky-400 focus:outline-none"
          >
            <option value="ALL">Tất cả Khách hàng ({customersList.length})</option>
            {customersList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Full PO Table */}
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full min-w-[1220px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] font-bold uppercase tracking-wider text-slate-400 shadow">
              <tr className="border-b border-industrial-border">
                <th className="px-3.5 py-2.5">Mã PO &amp; Lô Phôi</th>
                <th className="px-3 py-2.5">Khách Hàng</th>
                <th className="px-3 py-2.5">Sản Phẩm &amp; Quy Trình</th>
                <th className="px-2.5 py-2.5 text-center">SL Đặt</th>
                <th className="px-2.5 py-2.5 text-center">Đang SX (WIP)</th>
                <th className="px-2.5 py-2.5 text-center">Xong CK (End)</th>
                <th className="px-2.5 py-2.5 text-center">Tồn Kho TP</th>
                <th className="px-2.5 py-2.5 text-center">Đã Giao</th>
                <th className="px-2.5 py-2.5 text-center">Còn Nợ</th>
                <th className="px-3 py-2.5">Hạn Giao</th>
                <th className="px-3 py-2.5">Trạng Thái</th>
                <th className="px-3.5 py-2.5 text-right">Thao Tác (Giao / QR / Truy Vết)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-border/60">
              {pagedOrders.map((po) => {
                const c = classifyPoHelpers(po);
                const statusVariant = c.isDelivered
                  ? 'success'
                  : c.isOverdue
                    ? 'danger'
                    : c.isReadyShip
                      ? 'info'
                      : c.isInProgress
                        ? 'warning'
                        : 'neutral';

                return (
                  <tr
                    key={po.poId}
                    className={`hover:bg-slate-800/40 ${c.isOverdue ? 'bg-red-950/10' : ''}`}
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="font-mono-num font-extrabold text-amber-300">{po.poId}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                        <span>{po.materialLot || 'LOT-VICO'}</span>
                        {po.faiStatus === 'PENDING_FAI' && (
                          <Badge variant="warning" className="text-[10px]">
                            Chờ FAI
                          </Badge>
                        )}
                        {po.faiStatus === 'FAI_PASSED' && (
                          <Badge variant="success" className="text-[10px]">
                            FAI Đạt
                          </Badge>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 font-medium text-slate-200">{po.customer}</td>

                    <td className="px-3 py-2.5">
                      <div className="font-bold text-sky-300">{po.productName}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {po.spId && <span className="font-mono-num text-slate-400">{po.spId}</span>}
                        {c.hasNoRouting ? (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateTab('master', {
                                masterSubTab: 'OPS',
                                masterSearch: po.productName,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/25"
                          >
                            <Wrench className="h-3 w-3" /> Chưa có NC (+ Khai báo)
                          </button>
                        ) : (
                          <span className="text-emerald-400">{c.opCount} công đoạn NC</span>
                        )}
                      </div>
                    </td>

                    <td className="font-mono-num px-2.5 py-2.5 text-center font-bold text-slate-100">
                      {formatNumber(po.qtyPo)}
                    </td>
                    <td className="font-mono-num px-2.5 py-2.5 text-center font-semibold text-amber-300">
                      {formatNumber(po.wipQty)}
                    </td>
                    <td className="font-mono-num px-2.5 py-2.5 text-center font-bold text-emerald-400">
                      {formatNumber(po.finishedQty)}
                    </td>
                    <td className="font-mono-num px-2.5 py-2.5 text-center font-bold text-cyan-300">
                      {formatNumber(po.stockQty)}
                    </td>
                    <td className="font-mono-num px-2.5 py-2.5 text-center font-bold text-sky-300">
                      {formatNumber(po.deliveredQty)}
                    </td>
                    <td
                      className={`font-mono-num px-2.5 py-2.5 text-center font-extrabold ${
                        po.remainQty > 0 ? 'text-red-400' : 'text-slate-500'
                      }`}
                    >
                      {formatNumber(po.remainQty)}
                    </td>

                    <td className="font-mono-num px-3 py-2.5">
                      <div className={c.isOverdue ? 'font-bold text-red-400' : 'text-slate-200'}>
                        {formatDateVn(po.dueDate)}
                      </div>
                      {c.isOverdue && (
                        <div className="text-[10px] font-bold text-red-400">🔥 Quá hạn giao</div>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      <Badge variant={statusVariant}>{po.status}</Badge>
                    </td>

                    <td className="px-3.5 py-2.5 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => openDeliverModal(po)}
                          title="Xuất kho giao hàng & Xem lịch sử đợt giao"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          🚚 Xuất Giao
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            navigateTo(`/print/traveler/${encodeURIComponent(po.poId)}`)
                          }
                          title="In Phiếu Công Nghệ kèm Mã QR từng nguyên công"
                        >
                          <Printer className="h-3.5 w-3.5 text-sky-300" />
                          🖨️ In Phiếu QR
                        </Button>

                        <button
                          type="button"
                          onClick={() =>
                            onNavigateTab('logs_qc', {
                              logsSubView: 'TRACE',
                              tracePoId: po.poId,
                            })
                          }
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-industrial-border bg-slate-900 px-2 text-xs font-semibold text-purple-300 hover:border-purple-400"
                          title="Truy vết 100% phôi - FAI - máy - công nhân - giao hàng"
                        >
                          <FileSearch className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(po)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-industrial-border bg-slate-900 px-2 text-slate-300 hover:border-sky-400 hover:text-white"
                          title="Chỉnh sửa thông tin PO"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <PaginationBar
          totalItems={filteredOrders.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
        />
      </Card>

      {/* ==================== MODAL: CREATE NEW PO ==================== */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="➕ Tạo Lệnh Sản Xuất / Đơn Hàng PO Mới"
        subtitle="Khai báo đầy đủ Mã lô phôi & Nhà cung cấp phôi đầu vào phục vụ truy vết nguồn gốc 100%"
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleCreatePo} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Mã Đơn Hàng / Lệnh PO (*)
              </label>
              <input
                type="text"
                required
                value={newPoId}
                onChange={(e) => setNewPoId(e.target.value)}
                placeholder="VD: PO2610-190"
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-bold text-amber-300"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Khách Hàng (*)
              </label>
              <input
                type="text"
                list="gcck-po-customers"
                value={newCustomer}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewCustomer(val);
                  if (!customProductMode) {
                    const matchProd = bootstrap.products.find((p) => p.customer === val);
                    if (matchProd) setNewProductName(matchProd.productName);
                  }
                }}
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-semibold text-slate-100"
              />
              <datalist id="gcck-po-customers">
                {customersList.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="font-bold uppercase text-slate-400">Tên Sản Phẩm / Bản Vẽ (*)</label>
              <button
                type="button"
                onClick={() => {
                  setCustomProductMode((v) => !v);
                  if (!customProductMode) setNewProductName('');
                }}
                className="text-[11px] font-bold text-sky-400 hover:underline"
              >
                {customProductMode
                  ? '← Chọn từ danh mục 334+ SP có sẵn'
                  : '+ Nhập tên sản phẩm đặt mới'}
              </button>
            </div>
            {customProductMode ? (
              <input
                type="text"
                required
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Nhập tên sản phẩm / mã bản vẽ mới..."
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-semibold text-sky-300"
              />
            ) : (
              <select
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-semibold text-sky-300"
              >
                {productsForSelectedCustomer.map((p) => (
                  <option key={p.spId} value={p.productName}>
                    [{p.spId}] {p.productName} ({p.customer})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                SL Đặt Hàng (*)
              </label>
              <input
                type="number"
                min={1}
                required
                value={newQtyPo}
                onChange={(e) => setNewQtyPo(Math.max(1, Number(e.target.value) || 1))}
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-bold text-emerald-300"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Hạn Giao Hàng (*)
              </label>
              <input
                type="date"
                required
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-semibold text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Ngày Nhập / Đúc Phôi
              </label>
              <input
                type="date"
                value={newCastDate}
                onChange={(e) => setNewCastDate(e.target.value)}
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-semibold text-slate-100"
              />
            </div>
          </div>

          {/* Traceability Material Lot & Supplier */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-sky-500/30 bg-sky-950/15 p-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-bold uppercase text-sky-300">
                🧬 Mã Lô Phôi Đầu Vào (Heat / Lot No.)
              </label>
              <input
                type="text"
                value={newMaterialLot}
                onChange={(e) => setNewMaterialLot(e.target.value)}
                placeholder="VD: LOT-VICO-2610-088"
                className="font-mono-num h-9 w-full rounded-lg border border-industrial-border bg-slate-950 px-3 font-semibold text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-sky-300">
                🏭 Nhà Cung Cấp Phôi / Xưởng Đúc
              </label>
              <input
                type="text"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="VD: Xưởng Đúc VICO Thắng Lợi"
                className="h-9 w-full rounded-lg border border-industrial-border bg-slate-950 px-3 font-semibold text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold uppercase text-slate-400">Ghi Chú Đơn Hàng</label>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Giao thành 2 đợt, yêu cầu chứng chỉ siêu âm mối đúc..."
              className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="warning" disabled={creatingPo}>
              <QrCode className="h-4 w-4" />
              {creatingPo ? 'Đang lưu...' : 'Lưu Lệnh PO Mới'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: DELIVERY & SHIPMENT HISTORY ==================== */}
      <Modal
        open={Boolean(deliverTargetPo)}
        onClose={() => setDeliverTargetPo(null)}
        title={`🚚 Xuất Kho Giao Hàng: ${deliverTargetPo?.poId || ''}`}
        subtitle={
          deliverTargetPo
            ? `${deliverTargetPo.customer} — ${deliverTargetPo.productName}`
            : ''
        }
        maxWidthClass="max-w-xl"
      >
        {deliverTargetPo && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-industrial-border bg-slate-950 p-3 text-center">
              <div>
                <div className="text-[11px] text-slate-400">SL Đặt PO</div>
                <div className="font-mono-num text-base font-extrabold text-slate-100">
                  {deliverTargetPo.qtyPo}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Xong CK (End)</div>
                <div className="font-mono-num text-base font-extrabold text-emerald-400">
                  {deliverTargetPo.finishedQty}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Đã Xuất Giao</div>
                <div className="font-mono-num text-base font-extrabold text-sky-400">
                  {deliverTargetPo.deliveredQty}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Còn Nợ Khách</div>
                <div className="font-mono-num text-base font-extrabold text-red-400">
                  {deliverTargetPo.remainQty}
                </div>
              </div>
            </div>

            {deliverQty > deliverTargetPo.stockQty && deliverTargetPo.stockQty >= 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 p-2.5 text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Lưu ý: SL xuất giao ({deliverQty}) lớn hơn Tồn kho thành phẩm hiện ghi nhận ở công
                  đoạn cuối ({deliverTargetPo.stockQty} SP). Vẫn cho phép xuất nếu lấy từ tồn đầu kỳ.
                </span>
              </div>
            )}

            <form onSubmit={handleRecordDelivery} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold uppercase text-slate-400">
                    SL Giao Đợt Này (*)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={deliverQty}
                    onChange={(e) => setDeliverQty(Math.max(1, Number(e.target.value) || 1))}
                    className="font-mono-num h-10 w-full rounded-xl border border-emerald-500/50 bg-slate-950 px-3 text-base font-extrabold text-emerald-300"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-bold uppercase text-slate-400">
                    Số Phiếu Xuất / Biển Số Xe / Ghi Chú
                  </label>
                  <input
                    type="text"
                    value={deliverNote}
                    onChange={(e) => setDeliverNote(e.target.value)}
                    placeholder="VD: PXK-2610-09, Xe 15C-123.45 nhận hàng..."
                    className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDeliverTargetPo(null)}>
                  Đóng
                </Button>
                <Button type="submit" variant="success" disabled={submittingDelivery}>
                  <CheckCircle2 className="h-4 w-4" />
                  {submittingDelivery ? 'Đang ghi sổ kho...' : 'Xác Nhận Xuất Giao Kho'}
                </Button>
              </div>
            </form>

            {/* Delivery History for this PO */}
            <div className="border-t border-industrial-border pt-3">
              <div className="mb-2 font-bold uppercase tracking-wider text-slate-400">
                📜 Lịch Sử Các Đợt Đã Xuất Giao ({targetPoDeliveries.length} đợt)
              </div>
              {targetPoDeliveries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-industrial-border p-3 text-center text-slate-500">
                  Chưa có đợt giao hàng nào được ghi nhận cho đơn {deliverTargetPo.poId}.
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-industrial-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-[11px] text-slate-400">
                      <tr>
                        <th className="px-2.5 py-1.5">Thời gian xuất</th>
                        <th className="px-2.5 py-1.5 text-center">SL Giao</th>
                        <th className="px-2.5 py-1.5">Người xuất</th>
                        <th className="px-2.5 py-1.5">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-industrial-border/50">
                      {targetPoDeliveries.map((d) => (
                        <tr key={d.id}>
                          <td className="font-mono-num px-2.5 py-1.5 text-slate-300">
                            {d.deliveredAt}
                          </td>
                          <td className="font-mono-num px-2.5 py-1.5 text-center font-bold text-emerald-400">
                            +{d.qtyDeliver}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-200">{d.deliveredBy}</td>
                          <td className="px-2.5 py-1.5 text-slate-400">{d.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== MODAL: EDIT PO ==================== */}
      <Modal
        open={Boolean(editTargetPo)}
        onClose={() => setEditTargetPo(null)}
        title={`✏️ Chỉnh Sửa Lệnh PO: ${editTargetPo?.poId || ''}`}
        subtitle={editTargetPo?.productName}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSaveEditPo} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">SL Đặt PO</label>
              <input
                type="number"
                min={1}
                value={editQtyPo}
                onChange={(e) => setEditQtyPo(Math.max(1, Number(e.target.value) || 1))}
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-bold text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">Hạn Giao</label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 font-semibold text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">Mã Lô Phôi</label>
              <input
                type="text"
                value={editMaterialLot}
                onChange={(e) => setEditMaterialLot(e.target.value)}
                className="font-mono-num h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">
                Nhà Cung Cấp Phôi
              </label>
              <input
                type="text"
                value={editSupplierName}
                onChange={(e) => setEditSupplierName(e.target.value)}
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-bold uppercase text-slate-400">Độ ưu tiên</label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-2.5 text-slate-100"
              >
                <option value={1}>1 — Khẩn cấp (VIP)</option>
                <option value={2}>2 — Bình thường</option>
                <option value={3}>3 — Dự trữ tồn kho</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block font-bold uppercase text-slate-400">Ghi chú</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="h-10 w-full rounded-xl border border-industrial-border bg-industrial-elevated px-3 text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditTargetPo(null)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={savingEdit}>
              {savingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
