import React, { useMemo, useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  Copy,
  DollarSign,
  Gauge,
  HelpCircle,
  Percent,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Zap,
} from 'lucide-react';
import type { MachineInfo, ProductCostingSummary } from '@shared/types';
import { computeGainsharing } from '@shared/gainsharingEngine';
import { formatNumber } from '@client/lib/formatters';
import { Badge, Button, Card, Modal, useToast } from '@client/components/ui/IndustrialPrimitives';

export interface GainsharingModalProps {
  open: boolean;
  onClose: () => void;
  initialProduct?: ProductCostingSummary | null;
  allProducts: ProductCostingSummary[];
  allMachines?: MachineInfo[];
}

export function GainsharingModal({
  open,
  onClose,
  initialProduct,
  allProducts,
  allMachines = [],
}: GainsharingModalProps) {
  const toast = useToast();

  // Selected product
  const [selectedSpId, setSelectedSpId] = useState<string>(
    initialProduct?.spId || allProducts[0]?.spId || 'SP001'
  );

  useEffect(() => {
    if (initialProduct?.spId) {
      setSelectedSpId(initialProduct.spId);
    } else if (allProducts.length > 0 && !selectedSpId) {
      setSelectedSpId(allProducts[0].spId);
    }
  }, [initialProduct, allProducts]);

  const activeProduct = useMemo(() => {
    return allProducts.find((p) => p.spId === selectedSpId) || allProducts[0] || null;
  }, [allProducts, selectedSpId]);

  // Operations breakdown of selected product
  const activeOps = activeProduct?.stepBreakdowns || [];
  const [selectedOpIdx, setSelectedOpIdx] = useState(0);

  // Fallback default seconds
  const currentOp = activeOps[selectedOpIdx] || null;
  const stdSeconds = currentOp ? currentOp.stdSeconds : (activeProduct?.totalSec || 1800);

  // Machine rate lookup
  const defaultMachine = useMemo(() => {
    // If machines list is available, pick M02 or match
    return allMachines.find((m) => m.id === 'M02') || allMachines[0] || {
      id: 'M02',
      name: 'Máy Tiện CNC 1',
      costPerHour: 87500,
    };
  }, [allMachines]);

  const [selectedMachineId, setSelectedMachineId] = useState<string>(defaultMachine.id);
  const activeMachine = useMemo(() => {
    return allMachines.find((m) => m.id === selectedMachineId) || defaultMachine;
  }, [allMachines, selectedMachineId, defaultMachine]);

  // Base shift cost (Đơn giá 1 Ca 8h = costPerHour * 8)
  const defaultShiftCost = (activeMachine.costPerHour || 87500) * 8;
  const [customShiftCost, setCustomShiftCost] = useState<number>(defaultShiftCost);

  useEffect(() => {
    setCustomShiftCost((activeMachine.costPerHour || 87500) * 8);
  }, [activeMachine]);

  // Baseline standard quantity in 1 shift
  const stdQtyCalculated = Math.max(1, Math.floor(28800 / Math.max(1, stdSeconds)));

  // Sliders and inputs for simulation
  const [actualQty, setActualQty] = useState<number>(Math.round(stdQtyCalculated * 1.25));
  const [bonusShareRate, setBonusShareRate] = useState<number>(0.4); // 40% for worker
  const [workerShiftWage, setWorkerShiftWage] = useState<number>(385000); // 385k/ca chuẩn
  const [scrapQty, setScrapQty] = useState<number>(0);
  const [scrapDamagePerPcs, setScrapDamagePerPcs] = useState<number>(50000);

  // Reset actualQty whenever product or operation changes to show 125% surplus by default
  useEffect(() => {
    const std = Math.max(1, Math.floor(28800 / Math.max(1, stdSeconds)));
    setActualQty(Math.round(std * 1.25));
  }, [stdSeconds]);

  // Compute gainsharing results real-time
  const result = useMemo(() => {
    return computeGainsharing({
      productName: activeProduct?.productName || 'Sản phẩm cơ khí',
      opName: currentOp?.opName || 'Gia công chi tiết',
      machineId: activeMachine.id,
      machineName: activeMachine.name,
      stdSeconds,
      shiftHours: 8,
      shiftCost: customShiftCost,
      actualQty,
      actualHours: 8,
      workerShiftWage,
      bonusShareRate,
      scrapQty,
      scrapDamagePerPcs,
    });
  }, [
    activeProduct,
    currentOp,
    activeMachine,
    stdSeconds,
    customShiftCost,
    actualQty,
    workerShiftWage,
    bonusShareRate,
    scrapQty,
    scrapDamagePerPcs,
  ]);

  const copyExecutiveSummary = () => {
    const summaryText = `
=== BẢN ĐỐI SOÁT HIỆU QUẢ KHOÁN NĂNG SUẤT (WIN - WIN) ===
• Sản phẩm: ${activeProduct?.productName || ''} (${activeProduct?.customer || ''})
• Máy gia công: ${activeMachine.name} (Đơn giá trọn gói: ${formatNumber(customShiftCost)} đ/ca 8h = ${formatNumber(result.costPerHour)} đ/h)
• Định mức chuẩn: ${formatNumber(stdSeconds)}s/chi tiết -> Sản lượng chuẩn: ${result.stdQtyPerShift} cái/ca
--------------------------------------------------
1. KẾT QUẢ THỰC TẾ TRONG CA 8H:
   - Sản lượng đạt: ${result.actualQty} cái đạt chuẩn KCS
   - Năng suất đạt: ${result.kpiPct}% định mức (Vượt +${result.surplusQty} cái)
   - Tiết kiệm giờ máy: ${result.surplusHours} giờ dôi ra
   - Tổng giá trị thặng dư làm lợi cho xưởng: ${formatNumber(result.grossSurplusValue)} đ

2. PHÂN BỔ THẶNG DƯ (Cơ chế ${Math.round(bonusShareRate * 100)}% Thợ - ${Math.round((1 - bonusShareRate) * 100)}% Công ty):
   ★ THỢ ĐƯỢC THƯỞNG: +${formatNumber(result.workerIncentiveBonus)} đ/ca (+${formatNumber(result.workerBonusPerSurplusPcs)} đ/cái vượt)
     -> Tổng thu nhập ca: ${formatNumber(result.workerTotalTurnIncome)} đ/ca
     -> Quy đổi nếu duy trì cả tháng: +${formatNumber(result.projectedMonthlyWorkerBonus)} đ thưởng thêm!
   ★ CÔNG TY HƯỞNG LÃI RÒNG THÊM: +${formatNumber(result.companySurplusProfit)} đ/ca
     -> Quy đổi cả tháng trên máy này: +${formatNumber(result.projectedMonthlyCompanyProfit)} đ lãi ròng tăng thêm!
   ★ GIÁ THÀNH ĐƠN VỊ THỰC TẾ: Giảm từ ${formatNumber(result.stdOpUnitCost)} đ -> ${formatNumber(result.actualUnitMachiningCost)} đ/cái (Tiết kiệm ${result.unitCostReductionPct}%)
--------------------------------------------------
* Cam kết: Hàng lỗi NG đền bù theo quy định, bảo vệ an toàn dao cụ & máy móc 100%.
    `.trim();

    void navigator.clipboard.writeText(summaryText);
    toast.success('Đã sao chép Báo Cáo Đối Soát Ban Giám Đốc vào bộ nhớ tạm!');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="⚡ Quyết Toán Khoán & Chia Thưởng Năng Suất (Gainsharing)"
      subtitle="Mô hình Win - Win: Trích thưởng thợ từ chính giá trị giờ máy tiết kiệm được, doanh nghiệp tăng lợi nhuận ròng"
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Công thức chuẩn theo <b>Đơn giá Ca trọn gói / 28.800s</b> của xưởng</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={copyExecutiveSummary}>
              <Copy className="h-4 w-4" /> Sao chép tóm tắt gửi BGĐ
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 p-1 text-slate-800">
        {/* ROW 1: SELECTOR & MACHINE RATE INFO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              1. Chọn Sản phẩm ({allProducts.length} SP)
            </label>
            <select
              value={selectedSpId}
              onChange={(e) => {
                setSelectedSpId(e.target.value);
                setSelectedOpIdx(0);
              }}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-blue-500 focus:outline-none font-medium truncate"
            >
              {allProducts.map((p) => (
                <option key={p.spId} value={p.spId}>
                  [{p.customer}] {p.productName} ({p.opCount} bước)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              2. Bước Công Nghệ (Nguyên công)
            </label>
            {activeOps.length > 0 ? (
              <select
                value={selectedOpIdx}
                onChange={(e) => setSelectedOpIdx(Number(e.target.value))}
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-blue-500 focus:outline-none font-medium truncate"
              >
                {activeOps.map((op, idx) => (
                  <option key={op.ncId} value={idx}>
                    B{op.stepOrder}: {op.opName} ({formatNumber(op.stdSeconds)}s)
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-slate-500 py-1.5 px-2 bg-slate-100 rounded-lg">
                Toàn bộ sản phẩm ({formatNumber(stdSeconds)}s)
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              3. Máy gia công & Đơn giá Ca
            </label>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-blue-500 focus:outline-none font-medium truncate"
            >
              {allMachines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {formatNumber((m.costPerHour || 87500) * 8)} đ/ca ({formatNumber(m.costPerHour || 87500)} đ/h)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* BENCHMARK STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs bg-blue-50/70 border border-blue-200/80 p-2.5 rounded-xl">
          <div>
            <div className="text-slate-500 text-[11px]">Định mức 1 chi tiết</div>
            <div className="font-bold text-slate-900 text-sm">{formatNumber(stdSeconds)} giây ({Number((stdSeconds / 60).toFixed(1))}p)</div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Sản lượng chuẩn ca 8h</div>
            <div className="font-bold text-blue-700 text-sm">{result.stdQtyPerShift} cái / ca</div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Đơn giá máy ĐM / cái</div>
            <div className="font-bold text-slate-900 text-sm">{formatNumber(result.stdOpUnitCost)} đ</div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Đơn giá giây máy</div>
            <div className="font-bold text-slate-900 text-sm">{result.costPerSec} đ / giây</div>
          </div>
        </div>

        {/* ROW 2: INTERACTIVE SIMULATION SLIDERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-blue-600" /> Sản lượng thực tế hoàn thành (cái)
              </span>
              <span className="text-sm font-black text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                {actualQty} cái ({result.kpiPct}% ĐM)
              </span>
            </div>
            <input
              type="range"
              min={Math.max(1, Math.round(result.stdQtyPerShift * 0.5))}
              max={Math.max(result.stdQtyPerShift + 30, Math.round(result.stdQtyPerShift * 2))}
              value={actualQty}
              onChange={(e) => setActualQty(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>Đạt chuẩn: {result.stdQtyPerShift} cái</span>
              <span className={result.surplusQty > 0 ? 'text-emerald-600 font-bold' : ''}>
                {result.surplusQty > 0 ? `Vượt: +${result.surplusQty} cái` : 'Chưa vượt'}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Percent className="h-4 w-4 text-emerald-600" /> Tỷ lệ thưởng Thợ / Công ty
              </span>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                Thợ: {Math.round(bonusShareRate * 100)}% | Cty: {Math.round((1 - bonusShareRate) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.8}
              step={0.05}
              value={bonusShareRate}
              onChange={(e) => setBonusShareRate(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>Thận trọng (20-30%)</span>
              <span className="font-semibold text-emerald-700">Khuyên dùng (40% - 50%)</span>
              <span>Đột phá (60-70%)</span>
            </div>
          </div>

          {/* QUALITY GUARDRAIL (PHẾ PHẨM / HÀNG NG) */}
          <div className="md:col-span-2 pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Chốt chặn KCS (Hàng lỗi NG):</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={scrapQty}
                  onChange={(e) => setScrapQty(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 rounded border border-slate-300 px-2 py-1 text-center font-bold text-rose-600 focus:outline-none"
                />
                <span className="text-slate-500">cái hỏng</span>
              </div>
            </div>

            {scrapQty > 0 && (
              <div className="flex items-center gap-2 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 text-xs font-medium">
                <span>Trừ đền bù phôi/công: -{formatNumber(result.scrapPenaltyTotal)} đ</span>
              </div>
            )}

            <div className="text-[11px] text-slate-500 italic">
              * Nếu phát sinh phế phẩm, tiền thưởng sẽ tự động trừ đền bù, tránh chạy ẩu.
            </div>
          </div>
        </div>

        {/* ROW 3: REAL-TIME VALUE SURPLUS CARDS (WIN - WIN) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* CARD 1: CÔNG NHÂN HƯỞNG */}
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-emerald-600" /> THỢ ĐƯỢC NHẬN
                </span>
                <Badge variant="success">+{Math.round(bonusShareRate * 100)}% thặng dư</Badge>
              </div>

              <div className="mt-3">
                <div className="text-2xl font-black text-emerald-950">
                  +{formatNumber(result.workerIncentiveBonus)} <span className="text-sm font-semibold">đ / ca</span>
                </div>
                <div className="text-xs text-emerald-700 font-medium mt-0.5">
                  Tương đương: <b>+{formatNumber(result.workerBonusPerSurplusPcs)} đ</b> / mỗi cái vượt
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-emerald-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Lương CB ca chuẩn:</span>
                  <span className="font-semibold">{formatNumber(workerShiftWage)} đ</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-900">
                  <span>Tổng thu nhập ca:</span>
                  <span>{formatNumber(result.workerTotalTurnIncome)} đ</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-200 text-xs text-emerald-800 bg-emerald-100/70 p-2.5 rounded-xl text-center font-bold">
              💰 Quy đổi 26 ca/tháng: +{formatNumber(result.projectedMonthlyWorkerBonus)} đ
              <div className="text-[11px] font-normal text-emerald-700">Tăng thêm ~{workerShiftWage > 0 ? Math.round((result.workerIncentiveBonus / workerShiftWage) * 100) : 0}% thu nhập tháng</div>
            </div>
          </div>

          {/* CARD 2: CÔNG TY HƯỞNG LỢI NHUẬN RÒNG */}
          <div className="rounded-2xl border-2 border-blue-300 bg-blue-50/70 p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-blue-600" /> CÔNG TY THU VỀ
                </span>
                <Badge variant="info">+{Math.round((1 - bonusShareRate) * 100)}% lãi ròng</Badge>
              </div>

              <div className="mt-3">
                <div className="text-2xl font-black text-blue-950">
                  +{formatNumber(result.companySurplusProfit)} <span className="text-sm font-semibold">đ / ca</span>
                </div>
                <div className="text-xs text-blue-700 font-medium mt-0.5">
                  Tiết kiệm được: <b>{result.surplusHours} giờ máy</b> chạy tiếp
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-blue-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Giá trị giờ máy làm lợi:</span>
                  <span className="font-semibold">{formatNumber(result.grossSurplusValue)} đ</span>
                </div>
                <div className="flex justify-between font-bold text-blue-900">
                  <span>Sản phẩm thu thêm:</span>
                  <span>+{result.surplusQty} cái giao sớm</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-blue-200 text-xs text-blue-800 bg-blue-100/70 p-2.5 rounded-xl text-center font-bold">
              📈 Lãi thêm 26 ca/tháng: +{formatNumber(result.projectedMonthlyCompanyProfit)} đ / máy
              <div className="text-[11px] font-normal text-blue-700">Tăng doanh thu mà không cần mua thêm máy</div>
            </div>
          </div>

          {/* CARD 3: GIẢM GIÁ THÀNH ĐƠN VỊ */}
          <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/70 p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-800 flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-violet-600" /> GIÁ THÀNH SẢN XUẤT
                </span>
                <Badge variant="purple">Giảm -{result.unitCostReductionPct}%</Badge>
              </div>

              <div className="mt-3">
                <div className="text-2xl font-black text-violet-950">
                  {formatNumber(result.actualUnitMachiningCost)} <span className="text-sm font-semibold">đ / cái</span>
                </div>
                <div className="text-xs text-violet-700 font-medium mt-0.5">
                  Giá thành ĐM ban đầu: <del>{formatNumber(result.stdOpUnitCost)} đ</del>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-violet-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Mức tiết kiệm / chi tiết:</span>
                  <span className="font-bold text-violet-900">-{formatNumber(result.unitCostReduction)} đ</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tổng lô ({result.actualQty} cái):</span>
                  <span className="font-bold text-violet-900">Tiết kiệm {formatNumber(result.unitCostReduction * result.actualQty)} đ</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-violet-200 text-xs text-violet-800 bg-violet-100/70 p-2.5 rounded-xl text-center font-bold">
              🎯 Tăng sức cạnh tranh báo giá
              <div className="text-[11px] font-normal text-violet-700">Dễ trúng thầu thêm các đơn hàng lớn</div>
            </div>
          </div>
        </div>

        {/* ROW 4: EXECUTIVE COMPARISON TABLE FOR THE BOARD */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600" /> Bảng Đối Soát Trực Quan Thuyết Phục Ban Giám Đốc
            </h4>
            <span className="text-[11px] text-slate-500">Ca làm việc 8 tiếng</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px]">
                  <th className="py-2.5 px-4 font-bold">Chỉ tiêu kinh tế kỹ thuật</th>
                  <th className="py-2.5 px-4 font-bold text-slate-700">Kịch bản 1: Chưa khoán (100% ĐM)</th>
                  <th className="py-2.5 px-4 font-bold text-blue-700 bg-blue-50/50">Kịch bản 2: Có khoán vượt ({result.kpiPct}%)</th>
                  <th className="py-2.5 px-4 font-bold text-emerald-700">Lợi ích thực tế (Chênh lệch)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 px-4 font-medium text-slate-800">Sản lượng hoàn thành KCS</td>
                  <td className="py-2 px-4 text-slate-600">{result.stdQtyPerShift} cái</td>
                  <td className="py-2 px-4 font-bold text-blue-700 bg-blue-50/50">{result.actualQty} cái</td>
                  <td className="py-2 px-4 font-bold text-emerald-600">+{result.surplusQty} cái giao sớm (+{result.kpiPct - 100}%)</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-medium text-slate-800">Chi phí máy công ty chi trả</td>
                  <td className="py-2 px-4 text-slate-600">{formatNumber(customShiftCost)} đ/ca cố định</td>
                  <td className="py-2 px-4 text-slate-600 bg-blue-50/50">{formatNumber(customShiftCost)} đ/ca (Không đổi)</td>
                  <td className="py-2 px-4 text-slate-500">Giữ nguyên (Không tăng chi phí máy)</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-medium text-slate-800">Thời gian máy chạy dôi ra</td>
                  <td className="py-2 px-4 text-slate-600">0 giờ</td>
                  <td className="py-2 px-4 font-bold text-blue-700 bg-blue-50/50">{result.surplusHours} giờ</td>
                  <td className="py-2 px-4 font-bold text-emerald-600">Tương đương nhận thêm việc trị giá {formatNumber(result.grossSurplusValue)} đ</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-medium text-slate-800">Tiền thưởng thợ nhận thêm</td>
                  <td className="py-2 px-4 text-slate-600">0 đ</td>
                  <td className="py-2 px-4 font-bold text-emerald-700 bg-blue-50/50">+{formatNumber(result.workerIncentiveBonus)} đ</td>
                  <td className="py-2 px-4 text-emerald-600 font-semibold">Trích từ tiền máy dôi ra (Cty không tốn thêm ngân sách)</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-medium text-slate-800">Lợi nhuận ròng công ty tăng thêm</td>
                  <td className="py-2 px-4 text-slate-600">0 đ</td>
                  <td className="py-2 px-4 font-bold text-blue-800 bg-blue-50/50">+{formatNumber(result.companySurplusProfit)} đ/ca</td>
                  <td className="py-2 px-4 font-bold text-blue-700">+{formatNumber(result.projectedMonthlyCompanyProfit)} đ/tháng/máy</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-medium text-slate-800">Giá thành máy / chi tiết</td>
                  <td className="py-2 px-4 text-slate-600">{formatNumber(result.stdOpUnitCost)} đ/cái</td>
                  <td className="py-2 px-4 font-bold text-violet-700 bg-blue-50/50">{formatNumber(result.actualUnitMachiningCost)} đ/cái</td>
                  <td className="py-2 px-4 font-bold text-violet-700">Giảm -{formatNumber(result.unitCostReduction)} đ/cái (-{result.unitCostReductionPct}%)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4 SOLID BULLETS FOR LEADERSHIP */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-950 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-amber-900">
            <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
            4 Luận Điểm "Thép" Bảo Đảm An Toàn Cho Doanh Nghiệp:
          </div>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 text-[11px]">
            <li><b>Quỹ thưởng tự sinh:</b> Tiền thưởng trích hoàn toàn từ phần giá trị giờ máy làm lợi dôi ra, công ty không phát sinh chi phí cố định nào.</li>
            <li><b>Chốt chặn chất lượng:</b> Thưởng chỉ tính trên sản phẩm đạt chuẩn KCS. Nếu phát sinh phế phẩm hàng NG, tiền phôi hỏng bị khấu trừ thẳng.</li>
            <li><b>Chốt chặn dao cụ & máy:</b> Áp dụng chế độ cắt định mức khuyến cáo trong thẻ nguyên công, không cho phép ép quá tải làm mẻ dao hay hư hại trục chính.</li>
            <li><b>Tăng năng lực xưởng (OEE):</b> Quay vòng đơn hàng nhanh gấp rưỡi, tăng uy tín giao hàng đúng hẹn cho khách hàng chiến lược.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
