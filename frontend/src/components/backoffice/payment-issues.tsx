'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaymentIssue, usePaymentIssues, useResolveIssue } from '@/lib/backoffice/administration';
import { formatMoney } from '@/lib/money';
import { EmptyState, Field, ListSkeleton, LoadError, PageHeader, Pill, SuperadminOnly, errorMessage, formatDateTime } from './common';

function ResolveDialog({ issue, onClose }: { issue: PaymentIssue | null; onClose: () => void }) {
  const resolve = useResolveIssue();
  const [note, setNote] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!issue || note.trim().length < 3) return;
    resolve.mutate(
      { orderId: issue.id, note: note.trim() },
      {
        onSuccess: () => {
          toast.success('Aviso resuelto');
          setNote('');
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error, 'No se pudo resolver')),
      },
    );
  }

  return (
    <ModalDialog open={issue !== null} onClose={onClose} labelledBy="resolve-dialog-title" className="w-[min(94vw,30rem)]">
      {issue && (
        <form onSubmit={submit} className="space-y-4 p-5">
          <header>
            <h2 id="resolve-dialog-title" className="text-lg font-extrabold">
              Resolver aviso del pedido #{issue.number}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{issue.issue}</p>
          </header>
          <Field label="¿Qué hiciste?" htmlFor="resolve-note" hint="Por ejemplo: reembolsado en Mercado Pago el 12/11. Queda en la auditoría.">
            <Input id="resolve-note" className="h-11" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={note.trim().length < 3 || resolve.isPending}>
              {resolve.isPending ? 'Guardando…' : 'Marcar como resuelto'}
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}

export function PaymentIssues() {
  const issues = usePaymentIssues();
  const [target, setTarget] = useState<PaymentIssue | null>(null);

  return (
    <SuperadminOnly>
      <PageHeader
        title="Pagos a revisar"
        description="Pagos que requieren una decisión tuya: un importe que no coincide, un pago repetido o uno que llegó tarde y sin stock. El sistema nunca reembolsa solo: hacelo desde tu cuenta de Mercado Pago y dejalo asentado acá."
      />
      {issues.isPending ? (
        <ListSkeleton rows={3} />
      ) : issues.isError ? (
        <LoadError />
      ) : issues.data.length === 0 ? (
        <EmptyState>No hay pagos para revisar.</EmptyState>
      ) : (
        <ul className="space-y-3" data-testid="issues-list">
          {issues.data.map((issue) => (
            <li key={issue.id} className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-black/5" data-testid="issue-item">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    Pedido #{issue.number} <Pill tone="warn">A revisar</Pill>
                  </p>
                  <p className="text-sm">{issue.issue}</p>
                </div>
                <p className="text-lg font-extrabold">{formatMoney(issue.total)}</p>
              </div>
              <dl className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium">Cliente: </dt>
                  <dd className="inline">
                    {issue.customer.name} · {issue.customer.email}
                    {issue.customer.phone && ` · ${issue.customer.phone}`}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium">Sucursal: </dt>
                  <dd className="inline">{issue.branch}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Pago en Mercado Pago: </dt>
                  <dd className="inline font-mono">{issue.paymentId ?? '—'}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Pagado: </dt>
                  <dd className="inline">{issue.paidAt ? formatDateTime(issue.paidAt) : '—'}</dd>
                </div>
              </dl>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setTarget(issue)} aria-label={`Resolver el aviso del pedido ${issue.number}`}>
                  Ya lo resolví
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ResolveDialog issue={target} onClose={() => setTarget(null)} />
    </SuperadminOnly>
  );
}
