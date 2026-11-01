import type { AvailabilityLevel } from '@/lib/catalog-types';
import { cn } from '@/lib/utils';

const STYLES: Record<AvailabilityLevel, { label: string; className: string }> = {
  in_stock: { label: 'Disponible', className: 'bg-success-soft text-success' },
  low: { label: 'Últimas unidades', className: 'bg-warning-soft text-warning' },
  out: { label: 'Sin stock', className: 'bg-muted text-muted-foreground' },
};

/** Etiqueta de disponibilidad. Con una sucursal elegida el texto habla de retiro en esa sucursal. */
export function AvailabilityBadge({
  level,
  branchName,
  className,
}: {
  level: AvailabilityLevel;
  branchName?: string;
  className?: string;
}) {
  const { label, className: tone } = STYLES[level];
  const text = branchName && level !== 'out' ? `${label} en ${branchName}` : branchName ? `Sin stock en ${branchName}` : label;
  return (
    <span className={cn('inline-block max-w-full truncate rounded-md px-2 py-0.5 text-xs font-semibold', tone, className)}>
      {text}
    </span>
  );
}
