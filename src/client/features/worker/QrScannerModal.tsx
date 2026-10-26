import React, { useEffect, useId, useRef, useState } from 'react';
import { Camera, ImageUp, QrCode, Sparkles, Terminal, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button, Modal } from '../../components/ui/IndustrialPrimitives';

export interface SampleQrPreset {
  qrPayload: string;
  title: string;
  subtitle: string;
  badge: string;
}

export interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (rawQr: string) => void;
  samplePresets?: SampleQrPreset[];
}

const DEFAULT_SAMPLE_PRESETS: SampleQrPreset[] = [
  {
    qrPayload: 'GCCK|PO485-01|NC098',
    title: 'PO485-01 · ALKTOP 1342 M',
    subtitle: 'NC098 — G/c hoàn thiện · Máy Tiện CNC 1 (ĐM 480s)',
    badge: 'Lệnh SX Khẩn',
  },
  {
    qrPayload: 'GCCK|PO485-01|NC274',
    title: 'PO485-01 · ALKTOP 1342 M (Bước Cuối)',
    subtitle: 'NC274 — G/c Cưa hoàn thiện [End] · Máy cưa băng (ĐM 3600s)',
    badge: 'Nhập Kho TP',
  },
  {
    qrPayload: 'GCCK|PO485-01|NC158',
    title: 'GCCK|PO485-01|NC158 · Búa đập VHC-111',
    subtitle: 'NC158 — G/c làm định vị · Máy tiện FUJI (ĐM 3600s)',
    badge: 'QR Mẫu Chuẩn',
  },
  {
    qrPayload: 'GCCK|PO-THEO-KH|NC088',
    title: 'Ống bạc chặn D174x428',
    subtitle: 'NC088 — G/c phay MP NC2 · Máy phay OKK1 (ĐM 720s)',
    badge: 'Phay Cơ Khí',
  },
];

type ScannerMode = 'QUICK' | 'CAMERA' | 'IMAGE';

export function QrScannerModal({
  open,
  onClose,
  onDetected,
  samplePresets,
}: QrScannerModalProps) {
  const [mode, setMode] = useState<ScannerMode>('QUICK');
  const [manualInput, setManualInput] = useState('');
  const [cameraStatus, setCameraStatus] = useState<string>('');
  const [scanError, setScanError] = useState<string>('');
  const [busyImage, setBusyImage] = useState(false);

  const reactUid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const readerDomId = `gcck-qr-reader-${reactUid}`;
  const fileReaderDomId = `gcck-qr-file-${reactUid}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const activeScanRef = useRef<boolean>(false);

  const presets = samplePresets && samplePresets.length > 0 ? samplePresets : DEFAULT_SAMPLE_PRESETS;

  const stopCameraSafely = async () => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (!inst) return;
    try {
      if (activeScanRef.current) {
        activeScanRef.current = false;
        await inst.stop();
      }
      inst.clear();
    } catch {
      // Ignore cleanup race errors
    }
  };

  useEffect(() => {
    if (!open) {
      void stopCameraSafely();
      setScanError('');
      setCameraStatus('');
      return;
    }

    if (mode !== 'CAMERA') {
      void stopCameraSafely();
      return;
    }

    let cancelled = false;
    setScanError('');
    setCameraStatus('Đang khởi động camera sau...');

    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      const el = document.getElementById(readerDomId);
      if (!el) return;

      try {
        const html5Qr = new Html5Qrcode(readerDomId);
        scannerRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (decodedText) => {
            if (cancelled) return;
            void stopCameraSafely().then(() => {
              onDetected(decodedText);
              onClose();
            });
          },
          () => {
            // Frame scan miss — normal while aiming
          }
        );
        if (!cancelled) {
          activeScanRef.current = true;
          setCameraStatus('Đưa mã QR trên Phiếu Công Nghệ vào khung ngắm...');
        } else {
          await html5Qr.stop().catch(() => {});
          html5Qr.clear();
        }
      } catch (err: any) {
        if (!cancelled) {
          setCameraStatus('');
          setScanError(
            err?.message
              ? `Không mở được Camera (${err.message}). Bạn có thể tải ảnh chụp QR hoặc chạm chọn QR Mẫu bên dưới.`
              : 'Thiết bị chưa cấp quyền Camera. Hãy chọn Ảnh QR hoặc bấm QR Mẫu bên dưới.'
          );
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void stopCameraSafely();
    };
  }, [open, mode, readerDomId, onDetected, onClose]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError('');
    setBusyImage(true);
    try {
      const fileQr = new Html5Qrcode(fileReaderDomId);
      const decoded = await fileQr.scanFile(file, false);
      fileQr.clear();
      onDetected(decoded);
      onClose();
    } catch {
      setScanError('Không đọc được mã QR trong bức ảnh này. Vui lòng chụp rõ nét hơn hoặc chọn mã mẫu.');
    } finally {
      setBusyImage(false);
      e.target.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) {
      setScanError('Vui lòng nhập chuỗi mã QR (VD: GCCK|PO485-01|NC098).');
      return;
    }
    onDetected(manualInput.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📷 Quét Mã QR Phiếu Công Nghệ (Shop Traveler)"
      subtitle="Tự động điền Lệnh SX (PO), Chi tiết bản vẽ, Nguyên công, Máy & Dao cụ trong 1 chạm"
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        {/* Hidden mount node for image-file QR decoding */}
        <div id={fileReaderDomId} className="hidden" />

        {/* 3 Mode Switcher Tabs (>= 48px height) */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-industrial-border bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => {
              setScanError('');
              setMode('CAMERA');
            }}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-bold transition-colors ${
              mode === 'CAMERA'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>Camera Sau</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScanError('');
              setMode('IMAGE');
            }}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-bold transition-colors ${
              mode === 'IMAGE'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ImageUp className="h-4 w-4" />
            <span>Tải Ảnh QR</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScanError('');
              setMode('QUICK');
            }}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-bold transition-colors ${
              mode === 'QUICK'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>QR Mẫu / Gõ</span>
          </button>
        </div>

        {/* Mode Viewport */}
        {mode === 'CAMERA' && (
          <div className="rounded-xl border border-industrial-border bg-slate-950 p-3">
            <div
              id={readerDomId}
              className="mx-auto min-h-[240px] w-full max-w-[320px] overflow-hidden rounded-lg bg-slate-900"
            />
            {cameraStatus && (
              <p className="mt-2 text-center text-xs font-medium text-sky-300">{cameraStatus}</p>
            )}
          </div>
        )}

        {mode === 'IMAGE' && (
          <div className="rounded-xl border border-dashed border-sky-500/50 bg-slate-950/80 p-4 text-center">
            <QrCode className="mx-auto h-10 w-10 text-sky-400" />
            <p className="mt-2 text-sm font-bold text-slate-100">
              Chọn hoặc chụp ảnh Phiếu Công Nghệ có mã QR
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Dùng tốt khi phiếu bọc túi nilon dính dầu hoặc camera trình duyệt bị chặn
            </p>
            <label className="mt-3 inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-sky-400">
              <ImageUp className="h-4 w-4" />
              <span>{busyImage ? 'Đang giải mã QR...' : 'CHỌN ẢNH MÃ QR'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={busyImage}
                className="hidden"
              />
            </label>
          </div>
        )}

        {mode === 'QUICK' && (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Terminal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={manualInput}
                onChange={(e) => {
                  setScanError('');
                  setManualInput(e.target.value);
                }}
                placeholder="GCCK|PO485-01|NC098"
                className="font-mono-num min-h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 pl-9 pr-3 text-sm font-semibold text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <Button type="submit" variant="primary" size="lg" className="shrink-0">
              Nạp QR
            </Button>
          </form>
        )}

        {scanError && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-amber-500/50 bg-amber-950/50 px-3 py-2.5 text-xs font-medium text-amber-200">
            <span>{scanError}</span>
            <button
              type="button"
              onClick={() => setScanError('')}
              className="shrink-0 text-amber-300 hover:text-white"
              aria-label="Ẩn lỗi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Always-Visible 1-Tap Quick-Sim Sample QR Cards */}
        <div className="space-y-2 border-t border-industrial-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              ⚡ Chạm Nhanh Mã QR Mẫu Thực Tế (1-Tap Demo)
            </span>
            <span className="text-[11px] text-slate-400">Không cần Camera</span>
          </div>

          <div className="space-y-2">
            {presets.map((preset) => (
              <button
                key={preset.qrPayload}
                type="button"
                onClick={() => {
                  onDetected(preset.qrPayload);
                  onClose();
                }}
                className="flex min-h-[54px] w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-industrial-border bg-industrial-elevated/90 px-3.5 py-2.5 text-left transition-all hover:border-emerald-400/70 hover:bg-slate-800 active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 font-mono-num text-[11px] font-bold text-emerald-300">
                      {preset.qrPayload}
                    </span>
                    <span className="text-[11px] font-semibold text-sky-300">{preset.badge}</span>
                  </div>
                  <div className="mt-1 truncate text-sm font-bold text-slate-100">
                    {preset.title}
                  </div>
                  <div className="truncate text-xs text-slate-400">{preset.subtitle}</div>
                </div>
                <QrCode className="h-6 w-6 shrink-0 text-emerald-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default QrScannerModal;
