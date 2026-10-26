import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, MessageCircle, ShieldCheck, Unlink } from 'lucide-react';
import type { AuthSessionUser } from '@shared/types';
import { apiClient } from '../../lib/apiClient';
import { Badge, Button, Modal, useToast } from '../../components/ui/IndustrialPrimitives';

export interface TelegramLinkModalProps {
  open: boolean;
  onClose: () => void;
  user: AuthSessionUser | null;
  botUsername?: string;
  onLinked: () => Promise<void> | void;
}

export function TelegramLinkModal({
  open,
  onClose,
  user,
  botUsername,
  onLinked,
}: TelegramLinkModalProps) {
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setChatId(user?.chatId || '');
    }
  }, [open, user?.chatId]);

  const handleSave = async (targetChatId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      await apiClient.post('/auth/telegram-link', { chatId: targetChatId.trim() });
      await onLinked();
      toast.success(
        targetChatId.trim()
          ? `Đã liên kết Telegram 1-1 (Chat ID: ${targetChatId.trim()}) cho ${user.name}.`
          : 'Đã hủy liên kết nhận tin nhắn Telegram.'
      );
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu liên kết Telegram.');
    } finally {
      setSaving(false);
    }
  };

  const cleanBot = String(botUsername || '').replace(/^@/, '').trim();
  const deepLinkUrl =
    cleanBot && user ? `https://t.me/${cleanBot}?start=${encodeURIComponent(user.workerId)}` : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📲 Liên Kết Telegram Cá Nhân 1-1"
      subtitle="Nhận biên lai sản lượng & lương tạm tính riêng tư sau mỗi ca"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 p-3 text-xs leading-relaxed text-emerald-100">
          <div className="flex items-center gap-2 font-bold text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Bảo mật thu nhập cá nhân 100%</span>
          </div>
          <p className="mt-1 text-emerald-100/90">
            Hệ thống chỉ gửi phiếu xác nhận sản lượng và thu nhập ca vào đúng tài khoản Telegram của{' '}
            <strong>{user?.name || 'bạn'}</strong> ({user?.workerId}). Tuyệt đối không đăng lương lên
            nhóm chung hay hiển thị cho đồng nghiệp khác.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-industrial-border bg-slate-950 px-3.5 py-2.5">
          <span className="text-xs font-semibold text-slate-400">Trạng thái hiện tại:</span>
          {user?.isLinked && user?.chatId ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Đã kết nối ({user.chatId})
            </Badge>
          ) : (
            <Badge variant="neutral">Chưa liên kết Chat ID</Badge>
          )}
        </div>

        {deepLinkUrl && (
          <a
            href={deepLinkUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-sky-500/15 px-4 py-2.5 text-sm font-bold text-sky-200 hover:bg-sky-500/25"
          >
            <MessageCircle className="h-4 w-4 text-sky-400" />
            <span>Mở Bot @{cleanBot} &amp; Bấm START tự động</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave(chatId);
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
              Telegram Chat ID cá nhân
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="VD: 5829104821"
              className="font-mono-num min-h-[48px] w-full min-w-0 rounded-xl border border-industrial-border bg-slate-950 px-3.5 text-sm font-semibold text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Gõ lệnh <code className="text-sky-300">/id</code> vào Bot xưởng hoặc @userinfobot để lấy dãy số Chat ID của bạn.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="success"
              size="lg"
              disabled={saving || !chatId.trim()}
              className="flex-1"
            >
              <MessageCircle className="h-4 w-4" />
              {saving ? 'Đang lưu...' : 'Lưu Liên Kết 1-1'}
            </Button>

            {user?.chatId && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={saving}
                onClick={() => void handleSave('')}
              >
                <Unlink className="h-4 w-4 text-red-400" />
                Hủy
              </Button>
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
}
