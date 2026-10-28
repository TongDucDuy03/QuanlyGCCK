import React, { useState } from 'react';
import {
  ExternalLink,
  FileCheck2,
  FileText,
  FolderOpen,
  ShieldAlert,
  ShieldCheck,
  CheckSquare,
  Square,
} from 'lucide-react';
import { parseGoogleDriveUrl, DEFAULT_DRIVE_FOLDER_URL } from '@shared/driveHelper';
import { Badge, Button, Modal } from '../../components/ui/IndustrialPrimitives';

export interface DrawingViewerModalProps {
  open: boolean;
  onClose: () => void;
  productName?: string;
  spId?: string | null;
  customer?: string;
  opName?: string;
  machineId?: string;
  drawingUrl?: string;
  techDocUrl?: string;
}

export function DrawingViewerModal({
  open,
  onClose,
  productName,
  spId,
  customer,
  opName,
  machineId,
  drawingUrl,
  techDocUrl,
}: DrawingViewerModalProps) {
  const [activeTab, setActiveTab] = useState<'drawing' | 'techDoc'>('drawing');
  const [chkDrawingMatched, setChkDrawingMatched] = useState(false);
  const [chkFixtureReady, setChkFixtureReady] = useState(false);
  const [chkFirstPieceInspected, setChkFirstPieceInspected] = useState(false);

  const currentUrl = activeTab === 'drawing' ? drawingUrl : techDocUrl;
  const parsed = parseGoogleDriveUrl(currentUrl);

  const allChecksPassed = chkDrawingMatched && chkFixtureReady && chkFirstPieceInspected;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📐 Bản Vẽ Kỹ Thuật & Hướng Dẫn Gia Công"
      subtitle="Tích hợp Google Drive phân xưởng — Kiểm soát bản vẽ chống sai lỗi"
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-4 text-xs text-slate-900">
        {/* Product & Operation Summary Bar */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-slate-900 text-sm">
              {productName || 'Chưa chọn sản phẩm'}
            </span>
            {spId && <Badge variant="neutral">Mã: {spId}</Badge>}
            {customer && <Badge variant="info">KH: {customer}</Badge>}
            {opName && <Badge variant="info">CĐ: {opName}</Badge>}
            {machineId && <Badge variant="warning">Máy: {machineId}</Badge>}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={parsed.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              Mở Tab Mới
            </a>
            <a
              href={DEFAULT_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold transition-all shadow-sm"
              title="Mở Thư Mục Bản Vẽ Tổng Google Drive"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
              Kho Driver Phân Xưởng
            </a>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('drawing')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold border-b-2 text-xs transition-colors ${
              activeTab === 'drawing'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            Bản Vẽ Kỹ Thuật (2D/3D)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('techDoc')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold border-b-2 text-xs transition-colors ${
              activeTab === 'techDoc'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
            Hướng Dẫn Gá Đặt & Công Nghệ
          </button>
        </div>

        {/* Viewer Container */}
        <div className="rounded-xl border border-slate-300 bg-white overflow-hidden shadow-inner">
          {parsed.isFile ? (
            <div className="relative w-full h-[500px] bg-slate-100">
              <iframe
                src={parsed.previewUrl}
                title="Google Drive Document Viewer"
                className="w-full h-full border-0"
                allow="autoplay"
              />
            </div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-4 bg-slate-50">
              <div className="w-16 h-16 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
                <FolderOpen className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-base font-extrabold text-slate-900">
                  Thư Mục Tài Liệu Kỹ Thuật & Bản Vẽ Google Drive
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sản phẩm này chưa được gán link file PDF riêng lẻ, hoặc đang dùng thư mục lưu trữ tập trung của nhà máy.
                  Tất cả nhân viên phân xưởng có thể mở trực tiếp xem bản vẽ không cần đăng nhập.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href={parsed.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Mở Thư Mục Bản Vẽ Trên Google Drive
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Anti-error Checklist (Chống sai lỗi phân xưởng theo yêu cầu Ban Giám Đốc) */}
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-amber-900 flex items-center gap-2 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Quy Trình Chống Sai Lỗi Phân Xưởng (Tự kiểm soát trước khi gia công)
            </span>
            {allChecksPassed ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Sẵn Sàng Gia Công
              </span>
            ) : (
              <span className="text-amber-800 font-bold text-[11px]">
                * Vui lòng tích xác nhận 3 bước an toàn
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setChkDrawingMatched((v) => !v)}
              className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all ${
                chkDrawingMatched
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
              }`}
            >
              {chkDrawingMatched ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <div className="text-[11px] leading-tight">
                <span className="font-extrabold block text-slate-900">1. Đúng Mã & Bản Vẽ</span>
                <span className="text-slate-600 text-[10px]">Đã đối chiếu kích thước, dung sai bản vẽ</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setChkFixtureReady((v) => !v)}
              className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all ${
                chkFixtureReady
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
              }`}
            >
              {chkFixtureReady ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <div className="text-[11px] leading-tight">
                <span className="font-extrabold block text-slate-900">2. Gá Đặt & Dao Cụ</span>
                <span className="text-slate-600 text-[10px]">Đã kẹp gá chắc chắn, đúng dao & chế độ cắt</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setChkFirstPieceInspected((v) => !v)}
              className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all ${
                chkFirstPieceInspected
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
              }`}
            >
              {chkFirstPieceInspected ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <div className="text-[11px] leading-tight">
                <span className="font-extrabold block text-slate-900">3. Đo Mẫu Đầu (FAI)</span>
                <span className="text-slate-600 text-[10px]">Đo kiểm đủ kích thước then chốt trước khi chạy loạt</span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose} size="sm">
            Đóng Lại
          </Button>
          <Button
            variant={allChecksPassed ? 'primary' : 'warning'}
            onClick={onClose}
            size="sm"
            className="flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            {allChecksPassed ? 'Đã Xác Nhận Đầy Đủ — Bắt Đầu Gia Công' : 'Tiếp Tục Gia Công'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
