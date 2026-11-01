'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  /** Id del título, para lectores de pantalla. */
  labelledBy: string;
  children: ReactNode;
  className?: string;
}

/** Diálogo modal nativo: el navegador atrapa el foco, cierra con Esc y bloquea lo de atrás. */
export function ModalDialog({ open, onClose, labelledBy, children, className }: ModalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className={cn('m-auto max-h-[92dvh] w-[min(94vw,40rem)] overflow-y-auto rounded-2xl p-0 shadow-xl backdrop:bg-black/50', className)}
    >
      {open && children}
    </dialog>
  );
}
