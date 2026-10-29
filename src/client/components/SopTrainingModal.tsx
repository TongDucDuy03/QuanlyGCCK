import React, { useState } from 'react';
import {
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Coins,
  Cpu,
  Layers,
  Printer,
  QrCode,
  Rocket,
  ShieldCheck,
  Smartphone,
  Truck,
  UserCheck,
  Wrench,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { VicoLogo } from './VicoLogo';

export interface SopTrainingModalProps {
  open: boolean;
  onClose: () => void;
  initialRole?: 'WORKER' | 'QC' | 'ADMIN';
}

export function SopTrainingModal({ open, onClose, initialRole = 'WORKER' }: SopTrainingModalProps) {
  const [roleTab, setRoleTab] = useState<'WORKER' | 'QC' | 'ADMIN'>(initialRole);
  const [selectedWorkerStep, setSelectedWorkerStep] = useState<number>(1);

  if (!open) return null;

  const workerSteps = [
    {
      step: 1,
      title: 'Chọn Khách Hàng & Sản Phẩm',
      badge: 'BƯỚC 1',
      desc: 'Bấm chọn Khách hàng trên dải nút (Đại Phú, TFG, Win-Win, Vico...) để lọc ngay danh sách chi tiết của khách đó mà không cần gõ bàn phím.',
      tip: '💡 Mẹo: Nếu quét mã QR trên Phiếu công nghệ, hệ thống sẽ tự động điền bước này trong 0.5 giây!',
      example: 'Ví dụ: Chạm [Đại Phú] ➔ Chọn chi tiết "Đĩa búa 2000×2000 D750".',
    },
    {
      step: 2,
      title: 'Chọn Máy Gia Công Đứng Vận Hành',
      badge: 'BƯỚC 2',
      desc: 'Chạm ô "Máy gia công đứng vận hành" ➔ Chọn đúng máy CNC bạn đang đứng làm việc (VD: Máy tiện FUJI, Doosan, Tiện CNC 1...).',
      tip: '⚠️ Chú ý: Nếu máy có Banner Vàng "Lưu ý bàn giao từ ca trước", hãy đọc kỹ chỉ dẫn gá đặt và bù mòn dao trước khi bấm máy!',
      example: 'Ví dụ: Chọn [Máy tiện FUJI].',
    },
    {
      step: 3,
      title: 'Chọn Nguyên Công Gia Công',
      badge: 'BƯỚC 3',
      desc: 'Hệ thống tự động đưa các nguyên công của sản phẩm đang chọn lên đầu danh sách (NC01, NC02...). Chỉ cần chạm chọn bước bạn làm.',
      tip: '★ Dấu sao vàng: Nguyên công có yêu cầu kiểm tra dung sai bắt buộc trước khi gửi báo cáo.',
      example: 'Ví dụ: [NC001] G/c Tiện NC2 tiện lỗ (ĐM: 2.700s).',
    },
    {
      step: 4,
      title: 'Chọn Chế Độ Ghép Máy',
      badge: 'BƯỚC 4',
      desc: 'Nếu chỉ đứng 1 máy duy nhất: Chọn "Máy chính (100%)". Nếu cùng lúc trông thêm máy thứ 2 chạy thô: Chọn "Ghép máy 2 (33%)".',
      tip: '💰 Chế độ ghép máy giúp cộng thêm 33% đơn giá vào tổng lương ca của bạn.',
      example: 'Ví dụ: Đang đứng tiện tinh FUJI chọn [Máy chính 100%].',
    },
    {
      step: 5,
      title: 'Nhập Sản Lượng Đạt & Phế Phẩm',
      badge: 'BƯỚC 5',
      desc: 'Dùng các nút bấm nhanh [+1] [+5] [+10] hoặc gõ số lượng chi tiết thực tế đã gia công đạt chuẩn trong ca làm việc.',
      tip: '🛑 Nếu có hàng hỏng (NG), nhập vào ô Phế phẩm để xưởng cân đối cấp bù phôi kịp thời.',
      example: 'Ví dụ: Bấm [+10] ➔ [+5] ➔ Được 15 sản phẩm đạt.',
    },
    {
      step: 6,
      title: 'Chọn Ca Làm Việc (Nhận Phụ Cấp Ăn Ca)',
      badge: 'BƯỚC 6',
      desc: 'Chọn Ca 1, Ca 2 hoặc Ca 3. Với Ca 2 và Ca 3, hệ thống sẽ tự động cộng thêm phụ cấp ăn ca 25.000 đ vào thu nhập của bạn.',
      tip: '🌙 Đi ca đêm (Ca 3) được tính thêm hệ số ca đêm và phụ cấp ăn ca tự động.',
      example: 'Ví dụ: Chọn [Ca 2 (14h - 22h)].',
    },
    {
      step: 7,
      title: 'Ghi Nhận Tiêu Hao Cạnh Dao Thực Tế',
      badge: 'BƯỚC 7',
      desc: 'Nhập số cạnh dao (chíp tiện/phay) thực tế đã sử dụng trong ca. Bấm "+ Đổi 1 mảnh mới" nếu cần nhận mảnh dao từ tủ.',
      tip: '📉 Xài dao tiết kiệm hơn định mức sẽ được ghi nhận thưởng tiết kiệm dao cụ cuối tháng!',
      example: 'Ví dụ: Mảnh CNMG 120408 dùng 1 cạnh dao.',
    },
    {
      step: 8,
      title: 'Bấm GỬI BÁO CÁO SẢN LƯỢNG',
      badge: 'BƯỚC 8',
      desc: 'Kiểm tra lại số tiền thu nhập của lượt này ở góc trên và bấm nút màu xanh to nhất màn hình: 🚀 GỬI BÁO CÁO SẢN LƯỢNG.',
      tip: '✓ Dữ liệu sẽ nhảy ngay lên màn hình TV Andon 55" và lưu vào phiếu lương tích lũy của bạn.',
      example: 'Thu nhập lượt này: +37.503 đ ➔ Bấm Gửi thành công!',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 text-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  Cẩm Nang Hướng Dẫn &amp; Quy Trình Vận Hành (SOP)
                </h2>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 border border-blue-200">
                  GCCK THẮNG LỢI
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Chuẩn hóa thao tác cho Công Nhân, Tổ Trưởng QC &amp; Quản Đốc Phân Xưởng
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              title="In bản hướng dẫn ra giấy A4 để dán tại xưởng"
            >
              <Printer className="h-4 w-4 text-blue-600" />
              <span>In A4 Dán Xưởng</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 3-Role Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setRoleTab('WORKER')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              roleTab === 'WORKER'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="h-4 w-4 text-emerald-600" />
            <span>1. Công Nhân Đứng Máy (8 Bước)</span>
          </button>

          <button
            type="button"
            onClick={() => setRoleTab('QC')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              roleTab === 'QC'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="h-4 w-4 text-amber-600" />
            <span>2. Tổ Trưởng / QC (Duyệt FAI &amp; Bàn Giao BM.GC.01.02)</span>
          </button>

          <button
            type="button"
            onClick={() => setRoleTab('ADMIN')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              roleTab === 'ADMIN'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>3. Quản Đốc (Kế Hoạch Ngày BM01 &amp; P&amp;L)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ==================== TAB 1: WORKER 8 STEPS ==================== */}
          {roleTab === 'WORKER' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-2 font-black text-emerald-900 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>QUY TRÌNH 8 BƯỚC THAO TÁC CÔNG NHÂN (CHU KỲ BÁO CÁO NHANH DƯỚI 20 GIÂY)</span>
                </div>
                <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                  Công nhân thực hiện chọn theo thứ tự mũi tên từ trên xuống dưới. Sau khi quen thao tác, mỗi lượt báo cáo chỉ mất từ 15 đến 20 giây trên điện thoại hoặc máy tính bảng gắn tại máy.
                </p>
              </div>

              {/* Step Flow Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {workerSteps.map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setSelectedWorkerStep(s.step)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      selectedWorkerStep === s.step
                        ? 'border-blue-600 bg-blue-50/80 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 mb-1">
                      {s.badge}
                    </span>
                    <span className="text-xs font-bold text-slate-900 line-clamp-1">
                      {s.title}
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Step Detailed Showcase */}
              {(() => {
                const cur = workerSteps[selectedWorkerStep - 1];
                return (
                  <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-sm">
                          {cur.step}
                        </span>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900">{cur.title}</h3>
                          <div className="text-xs text-slate-500 font-medium">{cur.example}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={selectedWorkerStep <= 1}
                          onClick={() => setSelectedWorkerStep((p) => Math.max(1, p - 1))}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        >
                          ‹ Trước
                        </button>
                        <button
                          type="button"
                          disabled={selectedWorkerStep >= 8}
                          onClick={() => setSelectedWorkerStep((p) => Math.min(8, p + 1))}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        >
                          Sau ›
                        </button>
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                      {cur.desc}
                    </p>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs font-bold text-amber-900">
                      {cur.tip}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ==================== TAB 2: QC & LEAD ==================== */}
          {roleTab === 'QC' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
                  <UserCheck className="h-5 w-5 text-amber-600 shrink-0" />
                  <span>QUY TRÌNH TỔ TRƯỞNG &amp; QA/QC (KIỂM SOÁT 3 TẦNG CHẤT LƯỢNG)</span>
                </div>
                <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                  Đảm bảo không lọt phế phẩm sang công đoạn sau, kiểm soát chặt chẽ tỷ lệ đạt/lỗi theo đúng Sổ chuyển giao công đoạn BM.GC.01.02.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-blue-700 font-extrabold text-xs uppercase">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-black">1</span>
                    Duyệt Mẫu Đầu (FAI)
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Ký Duyệt Con Đầu Tiên</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Với các lô từ 5 sản phẩm trở lên, công nhân gia công xong chi tiết số 1 bắt buộc mang cho QC hoặc Tổ trưởng đo kiểm. QC bấm &ldquo;✓ Đạt FAI&rdquo; thì công nhân mới được chạy tiếp hàng loạt.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 font-extrabold text-xs uppercase">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-black">2</span>
                    Dung Sai Quan Trọng (★)
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Tự Kiểm Điểm Đo Trọng Yếu</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tại các nguyên công có dấu sao vàng (★), công nhân phải đo và tích chọn dung sai đạt trước khi gửi báo cáo. Tổ trưởng kiểm tra ngẫu nhiên và duyệt biên bản trong tab &ldquo;Nhật Ký &amp; QC&rdquo;.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-xs uppercase">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-black">3</span>
                    Sổ Bàn Giao BM.GC.01.02
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Ký Nhận Chuyển Công Đoạn</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Khi chuyển hàng sang PX Hoàn Thiện hoặc PX Nhiệt Luyện, người nhận vào tab <strong>&ldquo;D. Sổ Bàn Giao Công Đoạn&rdquo;</strong>, kiểm đếm số lượng đạt, lỗi, thiếu và bấm &ldquo;✓ Nhận Đủ&rdquo; để xác nhận nghiệm thu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: ADMIN & MANAGER ==================== */}
          {roleTab === 'ADMIN' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                <div className="flex items-center gap-2 font-black text-blue-950 text-sm">
                  <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                  <span>QUY TRÌNH QUẢN ĐỐC &amp; BAN GIÁM ĐỐC (ĐIỀU ĐỘ &amp; LÃI/LỖ)</span>
                </div>
                <p className="mt-1 text-xs text-blue-900 leading-relaxed">
                  Lập kế hoạch phân bổ việc cho từng thợ theo ca, kiểm soát năng lực giờ máy, in biểu mẫu A4 và theo dõi biên lợi nhuận ròng.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="text-xs font-black uppercase text-blue-700">1. Kế Hoạch Ngày Form VICO BM01</div>
                  <h4 className="text-sm font-bold text-slate-900">Phân Công Ca &amp; Gửi Zalo Xưởng</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Vào tab <strong>&ldquo;Kế Hoạch &amp; Tuần&rdquo;</strong>, bấm &ldquo;+ Thêm Kế Hoạch Ngày Mới&rdquo; (hoặc sao chép từ ngày trước). Nhập mặt hàng và số lượng phân công cho 13 thợ. Bấm <strong>&ldquo;Gửi Nhóm Zalo&rdquo;</strong> để sao chép tin nhắn chuẩn gửi cho anh em xưởng đọc trước giờ giao ban.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="text-xs font-black uppercase text-indigo-700">2. In Phiếu Công Nghệ (Job Traveler)</div>
                  <h4 className="text-sm font-bold text-slate-900">Kèm Mã QR Dán Khay Phôi</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tại tab <strong>&ldquo;Lệnh PO &amp; Phiếu QR&rdquo;</strong>, bấm in biểu mẫu A4. Phiếu công nghệ có chứa mã QR định danh cho toàn bộ quy trình, công nhân chỉ cần giơ điện thoại quét là nhận diện ngay toàn bộ thông số kỹ thuật.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="text-xs font-black uppercase text-emerald-700">3. Giám Sát Tiến Độ Trên TV Andon</div>
                  <h4 className="text-sm font-bold text-slate-900">Bảng Điều Hành Trực Quan 55 Inch</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Mở cổng <strong>&ldquo;TV Andon 55&quot;&rdquo;</strong> cắm lên màn hình tivi lớn giữa xưởng. Hệ thống tự động cập nhật sản lượng từng thợ, tiến độ các lệnh PO và máy đang chạy/nghẽn mà không cần bấm F5.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="text-xs font-black uppercase text-purple-700">4. Đối Soát Lãi/Lỗ &amp; Đơn Giá Khách</div>
                  <h4 className="text-sm font-bold text-slate-900">Phân Hệ Báo Giá &amp; P&amp;L</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Định mức giây chuẩn = `Tổng thời gian ÷ Số sản phẩm ra trong ngày`. Hệ thống tự động phân rã Chi phí nhân công + Chi phí máy + Chi phí dao cụ và so sánh với Đơn giá khách hàng để cảnh báo các đơn hàng bị lỗ.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <VicoLogo className="h-5 w-auto object-contain" />
            <span>Hệ Thống Lean MES Xưởng Cơ Khí Chính Xác Thắng Lợi</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-blue-700"
          >
            Đã Hiểu Quy Trình &amp; Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default SopTrainingModal;
