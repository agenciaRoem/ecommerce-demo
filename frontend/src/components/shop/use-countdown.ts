'use client';

import { useEffect, useState } from 'react';

/** Tiempo que falta hasta `isoDate` como "mm:ss"; `null` si no hay fecha o ya pasó. */
export function useCountdown(isoDate: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isoDate) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isoDate]);

  if (!isoDate) return null;
  const remaining = Math.floor((new Date(isoDate).getTime() - now) / 1000);
  if (remaining <= 0) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`;
}
