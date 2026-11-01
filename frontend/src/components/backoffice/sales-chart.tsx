import { formatMoney } from '@/lib/money';
import type { Overview } from '@/lib/backoffice/analytics';
import { shortDay } from './common';

const WIDTH = 960;
const HEIGHT = 190;
const PAD = { top: 8, bottom: 22, left: 4, right: 4 };

/** Ventas por día en barras. Sin dependencias: es un SVG que escala con el ancho del contenedor. */
export function SalesChart({ series }: { series: Overview['series'] }) {
  const values = series.map((point) => Number(point.revenue));
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / series.length;
  const barWidth = Math.max(slot * 0.7, 1);

  // Etiquetas del eje: primer día, uno del medio y el último; más no entran sin pisarse.
  const labelAt = new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Ventas por día, ${series.length} días, total ${formatMoney(total)}`} className="h-auto w-full" data-testid="sales-chart">
      <line x1={PAD.left} x2={WIDTH - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} className="stroke-border" />
      {series.map((point, index) => {
        const value = values[index];
        const height = value > 0 ? Math.max((value / max) * plotHeight, 2) : 0;
        const x = PAD.left + index * slot + (slot - barWidth) / 2;
        return (
          <g key={point.day}>
            <rect x={x} y={HEIGHT - PAD.bottom - height} width={barWidth} height={height} rx={Math.min(barWidth / 4, 2)} className="fill-brand">
              <title>{`${shortDay(point.day)}: ${formatMoney(value)} · ${point.orders} ${point.orders === 1 ? 'pedido' : 'pedidos'}`}</title>
            </rect>
            {labelAt.has(index) && (
              <text x={x + barWidth / 2} y={HEIGHT - 6} textAnchor={index === 0 ? 'start' : index === series.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[13px]">
                {shortDay(point.day)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
