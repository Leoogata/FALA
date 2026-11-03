import React, { useEffect, useRef } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  role?: 'dialog' | 'alertdialog';
  titleId?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  role = 'dialog',
  titleId,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const id = titleId ?? 'modal-title';

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;

    // Trap focus
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={id}
        className="relative bg-white rounded-xl shadow-xl max-w-[460px] w-full p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={id} className="text-[17px] font-bold text-[var(--navy)]">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmLabel?: string;
  confirmVariant?: 'destructive' | 'primary';
  loading?: boolean;
  children: React.ReactNode;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel = 'Confirmar',
  confirmVariant = 'primary',
  loading = false,
  children,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} role="alertdialog">
      <div className="text-sm text-[var(--ink)] leading-relaxed">{children}</div>
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
