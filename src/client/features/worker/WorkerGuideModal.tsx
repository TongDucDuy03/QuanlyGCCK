import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowDown,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Layers,
  Play,
  Pause,
  Printer,
  RotateCcw,
  Sparkles,
  Wrench,
  X,
  FileSpreadsheet,
  Check,
} from 'lucide-react';

export interface WorkerGuideModalProps {
  open: boolean;
  onClose: () => void;
}

interface StepInfo {
  step: number;
  title: string;
  actionTitle: string;
  icon: React.ReactNode;
  color: string;
  badgeBg: string;
  badgeText: string;
  summary: string;
  instruction: string;
  proTip: string;
  mockUi: React.ReactNode;
}

export function WorkerGuideModal({ open, onClose }: WorkerGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'ANIMATION' | 'FLOWCHART'>('ANIMATION');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);

  const steps: StepInfo[] = [
    {
      step: 1,
      title: 'Chọn Khách Hàng & Sản Phẩm',
      actionTitle: '1. Chọn sản phẩm / bản vẽ',
      icon: <Building2 className="h-6 w-6 text-blue-600" />,
      color: 'border-blue-500 bg-blue-50/70',
      badgeBg: 'bg-blue-600 text-white',
      badgeText: 'Bước 1 / 8',
      summary: 'Lọc nhanh theo Khách hàng và chọn tên bản vẽ chi tiết',
      instruction:
        'Chạm vào tên Khách hàng (Win-Win, Thysen, Vico, TFG...) ở dải nút phía trên. Danh sách bản vẽ của riêng khách đó sẽ hiện ra ngay trong 1 giây mà không cần gõ bàn phím.',
      proTip: '💡 Mẹo nhanh: Không cần gõ ký tự hay dấu Φ, ", # — chỉ cần bấm nút Khách hàng là ra ngay bản vẽ tương ứng!',
      mockUi: (
        <div className="space-y-2 rounded-xl border border-blue-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">🏢 Lọc nhanh theo Khách hàng:</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <span className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-sm ring-2 ring-blue-300">
              ✓ Win-Win (15 SP)
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              Thysen (24)
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              Vico (38)
            </span>
          </div>
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-2 text-xs font-extrabold text-blue-900">
            Chi tiết bản vẽ: <strong>Pattern Drawing No 2CG00382</strong>
          </div>
        </div>
      ),
    },
    {
      step: 2,
      title: 'Chọn Máy Gia Công',
      actionTitle: '2. Chọn máy đứng vận hành',
      icon: <Cpu className="h-6 w-6 text-emerald-600" />,
      color: 'border-emerald-500 bg-emerald-50/70',
      badgeBg: 'bg-emerald-600 text-white',
      badgeText: 'Bước 2 / 8',
      summary: 'Chọn máy CNC hoặc máy cơ bạn đang trực tiếp đứng ca',
      instruction:
        'Chạm vào ô "Máy gia công đứng vận hành" ➔ Chọn máy thực tế bạn đang đứng (Ví dụ: Máy tiện FUJI, Máy phay Doosan, Tiện CNC 1...).',
      proTip: '⚠️ Hệ thống sẽ tự động cảnh báo Banner Vàng nếu ca trước có bàn giao đặc biệt về máy đó!',
      mockUi: (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-800 uppercase">Máy gia công đứng vận hành</div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-base font-black text-emerald-950">Máy tiện FUJI (CNC)</span>
            <span className="rounded-md bg-emerald-200/80 px-2 py-0.5 text-xs font-bold text-emerald-800">Đang chọn</span>
          </div>
        </div>
      ),
    },
    {
      step: 3,
      title: 'Chọn Nguyên Công',
      actionTitle: '3. Chọn nguyên công (NC)',
      icon: <Sparkles className="h-6 w-6 text-indigo-600" />,
      color: 'border-indigo-500 bg-indigo-50/70',
      badgeBg: 'bg-indigo-600 text-white',
      badgeText: 'Bước 3 / 8',
      summary: 'Chọn bước công nghệ gia công chi tiết',
      instruction:
        'Chạm vào ô Nguyên công ➔ Chọn đúng bước gia công (NC001 Tiện lỗ, NC002 Phay rãnh...). Hệ thống tự tải Định Mức Giờ (ĐM giây) và đơn giá lương.',
      proTip: '📌 Nguyên công thuộc bản vẽ bạn vừa chọn ở Bước 1 sẽ tự động được ưu tiên lên đầu danh sách.',
      mockUi: (
        <div className="rounded-xl border border-indigo-300 bg-indigo-50/80 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-800 uppercase">
            <span className="rounded bg-indigo-200 px-1.5 py-0.5">NC001</span>
            <span>Bước 1 (Bán TP WIP)</span>
          </div>
          <div className="mt-1 text-sm font-black text-slate-900">
            G/c Tiện NC2 tiện lỗ (ĐM: 2.700s — 0.75h)
          </div>
        </div>
      ),
    },
    {
      step: 4,
      title: 'Chọn Ghép Máy',
      actionTitle: '4. Chọn chế độ ghép máy',
      icon: <Layers className="h-6 w-6 text-violet-600" />,
      color: 'border-violet-500 bg-violet-50/70',
      badgeBg: 'bg-violet-600 text-white',
      badgeText: 'Bước 4 / 8',
      summary: 'Chọn máy chính 100% hoặc ghép máy phụ 0.33',
      instruction:
        'Nếu bạn đứng 1 máy duy nhất: chọn "Máy chính (100%)". Nếu bạn chạy song song 2 máy cùng lúc: chọn "Ghép máy 2 (0.33)" để được cộng thêm 33% đơn giá công đoạn.',
      proTip: '💰 Công thức Lean MES: Ghép máy giúp bạn tối ưu thời gian chu kỳ tự động và tăng thu nhập ca!',
      mockUi: (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border-2 border-emerald-500 bg-emerald-100/60 p-2.5 text-center font-black text-emerald-900 shadow-sm ring-2 ring-emerald-400">
            ✓ Máy chính (100%)
          </div>
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-center font-bold text-slate-600">
            Ghép máy 2 (0.33)
          </div>
        </div>
      ),
    },
    {
      step: 5,
      title: 'Nhập Sản Lượng Thực Tế',
      actionTitle: '5. Chọn sản lượng (OK / Rework / NG)',
      icon: <Coins className="h-6 w-6 text-amber-600" />,
      color: 'border-amber-500 bg-amber-50/70',
      badgeBg: 'bg-amber-600 text-white',
      badgeText: 'Bước 5 / 8',
      summary: 'Nhập số lượng hàng Đạt chuẩn, Sửa lại và Phế phẩm',
      instruction:
        'Bấm các nút [+] hoặc [-] để nhập số lượng: Sản lượng ĐẠT chuẩn (OK), Hàng sửa lại (Rework) và Hàng hủy (NG). Có nút bấm nhanh +5, +10 để thao tác nhanh bằng một tay.',
      proTip: '✅ Nếu phát sinh phế phẩm NG: Hãy chọn đúng nguyên nhân (Khách quan do phôi nứt / Chủ quan) để bảo toàn công.',
      mockUi: (
        <div className="space-y-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs font-black text-emerald-900 uppercase">
            <span>✅ Sản Lượng ĐẠT Chuẩn (OK)</span>
            <span className="rounded bg-emerald-200 px-2 py-0.5 text-xs font-bold">+5  +10</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button className="h-10 w-10 rounded-xl bg-white border border-slate-300 font-bold text-lg">-</button>
            <span className="font-mono-num text-3xl font-black text-emerald-700">1</span>
            <button className="h-10 w-10 rounded-xl bg-emerald-600 font-bold text-lg text-white">+</button>
          </div>
        </div>
      ),
    },
    {
      step: 6,
      title: 'Chọn Ca Làm Việc & Tăng Ca',
      actionTitle: '6. Chọn ca làm việc',
      icon: <Clock className="h-6 w-6 text-sky-600" />,
      color: 'border-sky-500 bg-sky-50/70',
      badgeBg: 'bg-sky-600 text-white',
      badgeText: 'Bước 6 / 8',
      summary: 'Chọn Ca 1, Ca 2, Ca 3 hoặc Hành chính và giờ tăng ca',
      instruction:
        'Chạm vào đúng Ca làm việc của bạn (Ca 1: 06h-14h, Ca 2: 14h-22h, Ca 3: 22h-06h, HC: 08h-17h). Nếu có làm thêm giờ, bấm chọn thêm số phút tăng ca (60p, 120p...).',
      proTip: '🌞 Ngày Chủ nhật hệ số lương tự động nhân 2.0x theo quy chế của công ty!',
      mockUi: (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-xl border-2 border-blue-500 bg-blue-100/70 p-2 text-center font-black text-blue-900 shadow-sm">
            ✓ Ca 1 (Sáng 06h-14h)
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-bold text-slate-700">
            Ca 2 (Chiều 14h-22h)
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-bold text-slate-700">
            Ca 3 (Đêm 22h-06h)
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-bold text-slate-700">
            Hành chính (08h-17h)
          </div>
        </div>
      ),
    },
    {
      step: 7,
      title: 'Số Cạnh Dao Tiêu Hao Thực Tế',
      actionTitle: '7. Nhập số cạnh dao tiêu hao',
      icon: <Wrench className="h-6 w-6 text-teal-600" />,
      color: 'border-teal-500 bg-teal-50/70',
      badgeBg: 'bg-teal-600 text-white',
      badgeText: 'Bước 7 / 8',
      summary: 'Theo dõi mòn cạnh dao và cấp phát chíp 1-đổi-1',
      instruction:
        'Mở rộng mục "Dao cụ & Đổi chíp 1-1". Hệ thống tự động tính số cạnh dao theo Định mức = (SL Đạt × ĐM cạnh/SP). Nếu thực tế mòn dao nhiều hơn, nhập số cạnh dao thực tế.',
      proTip: '🔄 Đổi mảnh mới: Phải nộp lại xác mảnh chíp cũ để áp dụng cơ chế 1-đổi-1 của phân xưởng.',
      mockUi: (
        <div className="rounded-xl border border-teal-300 bg-teal-50/80 p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-teal-900">
            <span>Số cạnh dao tiêu hao thực tế:</span>
            <span className="text-[11px] text-teal-700 font-mono-num">Tự động = 1 SP × 0.5 cạnh</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono-num text-2xl font-black text-teal-800">0.5</span>
            <span className="rounded-md bg-teal-200 px-2 py-0.5 text-xs font-bold text-teal-900">Chuẩn ĐM</span>
          </div>
        </div>
      ),
    },
    {
      step: 8,
      title: 'Gửi Báo Cáo Sản Lượng',
      actionTitle: '8. Gửi báo cáo sản lượng',
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />,
      color: 'border-emerald-600 bg-emerald-500 text-white',
      badgeBg: 'bg-emerald-600 text-white',
      badgeText: 'Bước 8 / 8',
      summary: 'Bấm nút gửi để ghi nhận sản lượng và tính lương ngay',
      instruction:
        'Kiểm tra lại số tiền lương lượt này hiển thị trên nút bấm. Bấm nút to màu xanh lá "🚀 GỬI BÁO CÁO SẢN LƯỢNG". Dữ liệu lập tức đồng bộ lên máy tính Quản đốc và Bảng Andon TV!',
      proTip: '🎉 Tiền công lượt này sẽ lập tức được cộng vào ô "Tích lũy hôm nay" ở góc trên màn hình!',
      mockUi: (
        <div className="rounded-2xl border-2 border-emerald-600 bg-emerald-600 p-3.5 text-center text-white shadow-md">
          <div className="text-base font-black tracking-wide">
            🚀 GỬI BÁO CÁO SẢN LƯỢNG (+37.503 đ)
          </div>
          <div className="mt-0.5 text-[11px] text-emerald-700">
            Lập tức cộng vào lương tích lũy hôm nay
          </div>
        </div>
      ),
    },
  ];

  // 10-Second Simulation Auto-Play Loop
  useEffect(() => {
    if (!open || activeTab !== 'ANIMATION' || !isPlaying) return;

    const intervalTime = 1300; // 1.3s per step x 8 steps ~ 10.4 seconds
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          return 0; // Loop back
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [open, activeTab, isPlaying, steps.length]);

  // Update progress bar
  useEffect(() => {
    setProgress(((currentStep + 1) / steps.length) * 100);
  }, [currentStep, steps.length]);

  if (!open) return null;

  const activeStep = steps[currentStep];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-2 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hướng dẫn báo cáo sản lượng 8 bước"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-4 py-3.5 text-white">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
                MES VICO
              </span>
              <h2 className="truncate text-base font-black sm:text-lg">
                Hướng Dẫn Thao Tác Báo Cáo Sản Lượng (8 Bước)
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-blue-700 truncate">
              Quy trình chuẩn cho công nhân xưởng cơ khí: Chọn KH &amp; SP ➔ Máy ➔ NC ➔ Ghép máy ➔ Sản lượng ➔ Ca ➔ Dao ➔ Báo cáo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Đóng hướng dẫn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation & Mode Switch */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('ANIMATION')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                activeTab === 'ANIMATION'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Play className="h-3.5 w-3.5" />
              <span>🎬 Mô Phỏng Nhanh 10 Giây</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('FLOWCHART')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                activeTab === 'FLOWCHART'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>🗺️ Sơ Đồ Toàn Cảnh (Mũi Tên)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100"
            title="In tài liệu hướng dẫn ra giấy A4"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600" />
            <span className="hidden sm:inline">In Poster A4</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">
          {activeTab === 'ANIMATION' ? (
            <div className="space-y-4">
              {/* Progress bar representing 10s playback */}
              <div>
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-600 mb-1.5">
                  <span className="text-blue-700">
                    Tiến trình: Bước {activeStep.step} / {steps.length} — {activeStep.title}
                  </span>
                  <span className="font-mono-num text-[11px] font-bold">
                    ~{(10.4 * (progress / 100)).toFixed(1)}s / 10.4s
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* 8-Step Breadcrumb Bar */}
              <div className="grid grid-cols-8 gap-1">
                {steps.map((st, idx) => (
                  <button
                    key={st.step}
                    type="button"
                    onClick={() => {
                      setCurrentStep(idx);
                      setIsPlaying(false);
                    }}
                    className={`flex flex-col items-center justify-center rounded-lg py-1.5 text-center transition-all ${
                      idx === currentStep
                        ? 'bg-blue-600 text-white font-black shadow-sm ring-2 ring-blue-300 scale-105'
                        : idx < currentStep
                          ? 'bg-blue-100 text-blue-900 font-bold'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <span className="text-xs">{st.step}</span>
                  </button>
                ))}
              </div>

              {/* Active Step Feature Box */}
              <div className={`rounded-2xl border-2 p-4 transition-all ${activeStep.color}`}>
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      {activeStep.icon}
                    </span>
                    <div>
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-black uppercase ${activeStep.badgeBg}`}>
                        {activeStep.badgeText}
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        {activeStep.title}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-slate-800 leading-relaxed">
                      {activeStep.instruction}
                    </p>
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">
                      {activeStep.proTip}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/90 p-3 shadow-inner">
                    <div className="mb-1 text-[11px] font-bold text-slate-500 uppercase">
                      📱 Vị trí nút bấm trên màn hình:
                    </div>
                    {activeStep.mockUi}
                  </div>
                </div>
              </div>

              {/* Player Controls */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    <span>{isPlaying ? 'Tạm Dừng' : 'Tiếp Tục Chạy (10s)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(0);
                      setIsPlaying(true);
                    }}
                    className="flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Phát Lại</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentStep === 0}
                    onClick={() => {
                      setCurrentStep((p) => Math.max(0, p - 1));
                      setIsPlaying(false);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40"
                    aria-label="Bước trước"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    disabled={currentStep === steps.length - 1}
                    onClick={() => {
                      setCurrentStep((p) => Math.min(steps.length - 1, p + 1));
                      setIsPlaying(false);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40"
                    aria-label="Bước sau"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Flowchart Mode: Full Overview With Arrows */
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 font-semibold">
                📌 <strong>Sơ đồ toàn cảnh 8 bước:</strong> Giúp công nhân mới nhìn vào nắm bắt toàn bộ luồng báo cáo sản xuất từ đầu đến cuối chỉ trong 30 giây!
              </div>

              <div className="space-y-2.5">
                {steps.map((st, i) => (
                  <React.Fragment key={st.step}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-400 transition-all">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 font-black text-blue-700 text-base">
                          {st.step}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <span>{st.title}</span>
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">{st.instruction}</p>
                          <div className="mt-1 text-[11px] font-bold text-amber-700">{st.proTip}</div>
                        </div>
                      </div>

                      <div className="shrink-0 sm:w-56 rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs">
                        <div className="font-extrabold text-slate-700 uppercase text-[10px] mb-1">Thao tác chính:</div>
                        <div className="font-bold text-blue-900">{st.actionTitle}</div>
                      </div>
                    </div>

                    {/* Arrow down between steps */}
                    {i < steps.length - 1 && (
                      <div className="flex items-center justify-center py-0.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-black text-xs shadow-inner">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs text-slate-500 font-medium">
            Hệ thống quản lý sản xuất cơ khí chính xác VICO MES
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700"
          >
            Đã Hiểu &amp; Bắt Đầu Thao Tác
          </button>
        </div>
      </div>
    </div>
  );
}
