'use client';

import { CameraIcon, CheckIcon, ImageIcon, Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { UploadedImage } from '@/lib/api-types';
import { compressImage } from '@/lib/image';
import { useUploadImage } from '@/lib/queries';

interface PhotoCaptureProps {
  value: UploadedImage | null;
  onChange: (image: UploadedImage | null) => void;
}

/** Foto del producto: abre la cámara trasera (o la galería), la reduce y la sube al elegirla. */
export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
  const upload = useUploadImage();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite volver a elegir la misma foto
    if (!file) return;

    onChange(null);
    setPreview(URL.createObjectURL(file));
    const blob = await compressImage(file);
    upload.mutate(blob, { onSuccess: onChange });
  }

  const shown = preview ?? value?.urls.card ?? null;

  return (
    <div className="space-y-3">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no optimizable por next/image
          <img src={shown} alt="Foto del producto" className="size-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground"
          >
            <CameraIcon className="size-10" />
            <span className="text-sm font-medium">Sacar foto del producto</span>
          </button>
        )}

        {upload.isPending && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm font-medium">
            <Loader2Icon className="size-5 animate-spin" /> Subiendo…
          </div>
        )}
        {value && !upload.isPending && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-xs font-medium text-white">
            <CheckIcon className="size-3" /> Lista
          </span>
        )}
      </div>

      {upload.isError && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo subir la foto. Inténtalo de nuevo.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => cameraInput.current?.click()}>
          <CameraIcon /> {shown ? 'Otra foto' : 'Cámara'}
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => galleryInput.current?.click()}>
          <ImageIcon /> Galería
        </Button>
      </div>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
