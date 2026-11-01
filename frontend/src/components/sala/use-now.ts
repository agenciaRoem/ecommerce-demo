'use client';

import { useEffect, useState } from 'react';

/** La hora actual, refrescada cada `intervalMs`, para mostrar "hace 12 min" sin recargar. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "hace 5 min", "hace 2 h 10 min", "hace 3 días". */
export function timeAgo(isoDate: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / 60_000));
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

/** Cuánto lleva esperando un pedido sin avanzar: ok, atención (> 30 min) o urgente (> 60 min). */
export function waitLevel(isoDate: string, now: number): 'ok' | 'warn' | 'late' {
  const minutes = (now - new Date(isoDate).getTime()) / 60_000;
  return minutes > 60 ? 'late' : minutes > 30 ? 'warn' : 'ok';
}
