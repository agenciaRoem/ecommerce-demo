'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

const CONFIRM_WINDOW_MS = 5000;

interface ConfirmButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick'> {
  /** Se ejecuta en el segundo clic. */
  onConfirm: () => void;
  confirmLabel?: string;
}

/** Acción delicada en dos pasos: el primer clic pide confirmación y se cancela solo si no se confirma. */
export function ConfirmButton({ onConfirm, confirmLabel = 'Confirmar', children, ...props }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <Button
      {...props}
      // Armado, el nombre accesible pasa a ser el de la confirmación (si no, un lector de pantalla seguiría leyendo la acción original).
      aria-label={armed ? confirmLabel : props['aria-label']}
      variant={armed ? 'destructive' : props.variant}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
