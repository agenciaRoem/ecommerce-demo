'use client';

import { XIcon } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';

// BarcodeDetector todavía no está en los tipos de TypeScript.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorConstructor = new (options?: { formats: string[] }) => BarcodeDetectorLike;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
const SCAN_INTERVAL_MS = 250;

const detectorConstructor = (): BarcodeDetectorConstructor | undefined =>
  (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

/** Indica si el navegador puede escanear códigos con la cámara (Chrome en Android, entre otros). */
export function useBarcodeScanSupport(): boolean {
  // En el servidor (y en la hidratación) se asume "no soportado"; el cliente corrige sin desajustes.
  return useSyncExternalStore(
    subscribeNever,
    () => Boolean(detectorConstructor() && navigator.mediaDevices?.getUserMedia),
    () => false,
  );
}

const subscribeNever = () => () => {};

export function BarcodeScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    async function start() {
      const Detector = detectorConstructor();
      if (!Detector) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled || !videoRef.current) return stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new Detector({ formats: FORMATS });
        timer = setInterval(async () => {
          if (!videoRef.current) return;
          const [code] = await detector.detect(videoRef.current).catch(() => []);
          if (code) onDetect(code.rawValue);
        }, SCAN_INTERVAL_MS);
      } catch {
        setError('No se pudo abrir la cámara. Revisa los permisos del navegador.');
      }
    }
    void start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetect]);

  return (
    <div role="dialog" aria-label="Escanear código de barras" className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white">
        <p className="text-sm">Apunta al código de barras</p>
        <Button variant="ghost" size="icon-lg" aria-label="Cerrar escáner" onClick={onClose} className="text-white">
          <XIcon />
        </Button>
      </div>
      <div className="relative flex-1">
        <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-lg border-2 border-white/80" />
      </div>
      {error && <p className="p-4 text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}
