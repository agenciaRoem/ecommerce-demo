'use client';

import { CheckIcon, MapPinIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { writeBranchCookie } from '@/lib/branch-cookie';
import type { StoreBranch } from '@/lib/catalog-types';
import { cn } from '@/lib/utils';

/** "Retiro en: …". Guarda la sucursal en una cookie para que el servidor muestre el stock de esa sucursal. */
export function BranchSelector({ branches, selectedId }: { branches: StoreBranch[]; selectedId?: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = branches.find((branch) => branch.id === selectedId);

  function choose(branchId: string | null) {
    writeBranchCookie(branchId);
    dialog.current?.close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex min-w-0 items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <MapPinIcon className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="truncate">
          Retiro en: <span className="font-semibold text-brand">{selected?.name ?? 'elegí tu sucursal'}</span>
        </span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="branch-dialog-title"
        onClick={(event) => event.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(92vw,26rem)] rounded-2xl p-0 shadow-xl backdrop:bg-black/50"
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 id="branch-dialog-title" className="text-lg font-bold">
              ¿Dónde querés retirar?
            </h2>
            <p className="text-sm text-muted-foreground">Te mostramos el stock real de la sucursal que elijas.</p>
          </div>
          <ul className="space-y-2">
            {branches.map((branch) => {
              const active = branch.id === selectedId;
              return (
                <li key={branch.id}>
                  <button
                    type="button"
                    onClick={() => choose(branch.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition hover:border-brand',
                      active && 'border-brand bg-brand-soft',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{branch.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{branch.address}</span>
                    </span>
                    {active && <CheckIcon className="size-5 shrink-0 text-brand" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => choose(null)} disabled={!selected}>
              Quitar selección
            </Button>
            <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>
              Cerrar
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
