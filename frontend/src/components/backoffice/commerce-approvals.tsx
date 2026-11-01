'use client';

import { SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { CommerceCustomer, CommerceStatus, useCommerce, useVerifyCuit } from '@/lib/backoffice/administration';
import { useDebouncedValue } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { EmptyState, Field, ListSkeleton, LoadError, PageHeader, Pager, Pill, SuperadminOnly, errorMessage, formatDay } from './common';

const TABS: { value: CommerceStatus; label: string }[] = [
  { value: 'pending', label: 'Esperando aprobación' },
  { value: 'verified', label: 'Aprobados' },
  { value: 'all', label: 'Todos' },
];

/** Pide con qué se comprobó el CUIT: queda en la auditoría junto a quién lo aprobó. */
function VerifyDialog({ target, onClose }: { target: { customer: CommerceCustomer; verified: boolean } | null; onClose: () => void }) {
  const verify = useVerifyCuit();
  const [note, setNote] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target || note.trim().length < 3) return;
    verify.mutate(
      { id: target.customer.id, verified: target.verified, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(target.verified ? 'CUIT aprobado: ya ve precios mayoristas' : 'Aprobación revocada');
          setNote('');
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar')),
      },
    );
  }

  return (
    <ModalDialog open={target !== null} onClose={onClose} labelledBy="verify-dialog-title" className="w-[min(94vw,30rem)]">
      {target && (
        <form onSubmit={submit} className="space-y-4 p-5">
          <header>
            <h2 id="verify-dialog-title" className="text-lg font-extrabold">
              {target.verified ? 'Aprobar CUIT' : 'Revocar aprobación'}
            </h2>
            <p className="text-sm font-medium">{target.customer.businessName}</p>
            <p className="font-mono text-sm text-muted-foreground">{target.customer.cuit}</p>
          </header>
          {target.verified && (
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              El sistema solo verifica que el número sea posible. Antes de aprobar, comprobá la constancia de inscripción en ARCA. El comercio ve los precios mayoristas al renovar su sesión (hasta 15 minutos) o al volver a ingresar.
            </p>
          )}
          <Field label={target.verified ? '¿Con qué lo comprobaste?' : '¿Por qué se revoca?'} htmlFor="verify-note" hint="Queda registrado en la auditoría.">
            <Input id="verify-note" className="h-11" maxLength={200} placeholder={target.verified ? 'Constancia de ARCA del 12/11' : 'Los datos no coinciden'} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={note.trim().length < 3 || verify.isPending}>
              {verify.isPending ? 'Guardando…' : target.verified ? 'Aprobar' : 'Revocar'}
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}

export function CommerceApprovals() {
  const [status, setStatus] = useState<CommerceStatus>('pending');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [page, setPage] = useState(1);
  const customers = useCommerce(status, search, page);
  const [target, setTarget] = useState<{ customer: CommerceCustomer; verified: boolean } | null>(null);

  return (
    <SuperadminOnly>
      <PageHeader
        title="Comercios (CUIT)"
        description="Un comercio nuevo compra a precio minorista hasta que apruebes su CUIT. Los que esperan hace más tiempo van primero."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Estado" className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={cn('rounded-md px-3 py-1.5 font-medium', status === tab.value && 'bg-white shadow-sm')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Buscar comercio"
            placeholder="Razón social, email o CUIT"
            className="h-10 pl-9"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {customers.isPending ? (
        <ListSkeleton />
      ) : customers.isError ? (
        <LoadError />
      ) : customers.data.items.length === 0 ? (
        <EmptyState>{status === 'pending' && !search ? 'No hay comercios esperando aprobación.' : 'No hay comercios con ese criterio.'}</EmptyState>
      ) : (
        <div className={cn('space-y-2', customers.isPlaceholderData && 'opacity-60')}>
          <ul className="divide-y rounded-xl bg-white ring-1 ring-black/5" data-testid="commerce-list">
            {customers.data.items.map((customer) => (
              <li key={customer.id} className="flex flex-wrap items-center justify-between gap-3 p-3" data-testid="commerce-item">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {customer.businessName}
                    {customer.cuitVerified ? <Pill tone="ok">CUIT aprobado</Pill> : <Pill tone="warn">Sin aprobar</Pill>}
                    {!customer.isActive && <Pill tone="muted">Cuenta inactiva</Pill>}
                  </p>
                  <p className="font-mono text-sm">{customer.cuit}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {customer.contactName} · {customer.email}
                    {customer.phone && ` · ${customer.phone}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Registrado el {formatDay(customer.createdAt)} · {customer.orders} {customer.orders === 1 ? 'pedido' : 'pedidos'}
                  </p>
                </div>
                {customer.cuitVerified ? (
                  <Button variant="outline" size="sm" onClick={() => setTarget({ customer, verified: false })} aria-label={`Revocar aprobación de ${customer.businessName}`}>
                    Revocar
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setTarget({ customer, verified: true })} aria-label={`Aprobar CUIT de ${customer.businessName}`}>
                    Aprobar CUIT
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pager page={page} limit={customers.data.limit} total={customers.data.total} onPage={setPage} disabled={customers.isPlaceholderData} />
        </div>
      )}

      <VerifyDialog target={target} onClose={() => setTarget(null)} />
    </SuperadminOnly>
  );
}
