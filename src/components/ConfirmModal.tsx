import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  isDestructive = true,
  onConfirm,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Confirmation action failed:', err);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isProcessing) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-sm rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl p-5 sm:p-6 z-10 text-[var(--ink)] modal-animated space-y-4">
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          title="ปิด"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDestructive
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            {isDestructive ? (
              <Trash2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-1.5 pr-4">
            <h3
              id="confirm-modal-title"
              className="text-base sm:text-lg font-bold text-[var(--ink)] leading-snug"
            >
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--ink-soft)] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 hover:bg-[var(--bg)] text-[var(--ink)] transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirmClick}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl text-white transition-all shadow-sm cursor-pointer active:scale-98 flex items-center gap-1.5 disabled:opacity-50 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-deep)]'
            }`}
          >
            {isDestructive && <Trash2 className="w-3.5 h-3.5" />}
            <span>{isProcessing ? '...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
