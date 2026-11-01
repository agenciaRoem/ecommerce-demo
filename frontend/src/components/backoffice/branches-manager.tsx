'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { AdminBranch, useAdminBranches, useCreateBranch, useUpdateBranch } from '@/lib/backoffice/administration';
import { cn } from '@/lib/utils';
import { Field, ListSkeleton, LoadError, PageHeader, Pill, SuperadminOnly, errorMessage, fieldErrors } from './common';

function BranchDialog({ branch, open, onClose }: { branch: AdminBranch | null; open: boolean; onClose: () => void }) {
  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="branch-dialog-title" className="w-[min(94vw,30rem)]">
      {open && <BranchForm key={branch?.id ?? 'new'} branch={branch} onClose={onClose} />}
    </ModalDialog>
  );
}

function BranchForm({ branch, onClose }: { branch: AdminBranch | null; onClose: () => void }) {
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const [name, setName] = useState(branch?.name ?? '');
  const [code, setCode] = useState(branch?.code ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [phone, setPhone] = useState(branch?.phone ?? '');

  const pending = create.isPending || update.isPending;
  const errors = fieldErrors(create.error ?? update.error);
  const valid = name.trim().length >= 2 && address.trim().length >= 5 && (branch !== null || /^[A-Za-z0-9]{2,6}$/.test(code.trim()));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const done = {
      onSuccess: () => {
        toast.success(branch ? 'Sucursal actualizada' : 'Sucursal creada');
        onClose();
      },
      onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo guardar')),
    };
    if (branch) update.mutate({ id: branch.id, name: name.trim(), address: address.trim(), phone: phone.trim() || null }, done);
    else create.mutate({ name: name.trim(), code: code.trim(), address: address.trim(), phone: phone.trim() || undefined }, done);
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <h2 id="branch-dialog-title" className="text-lg font-extrabold">
        {branch ? `Editar ${branch.name}` : 'Nueva sucursal'}
      </h2>
      <Field label="Nombre" htmlFor="branch-name" error={errors.name}>
        <Input id="branch-name" className="h-11" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Sigla" htmlFor="branch-code" hint={branch ? 'La sigla no se puede cambiar.' : 'De 2 a 6 letras o números (ej. CEN). No se puede cambiar después.'} error={errors.code}>
        <Input id="branch-code" className="h-11 uppercase" maxLength={6} value={code} disabled={branch !== null} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Field label="Dirección" htmlFor="branch-address" error={errors.address}>
        <Input id="branch-address" className="h-11" maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label="Teléfono (opcional)" htmlFor="branch-phone" error={errors.phone}>
        <Input id="branch-phone" inputMode="tel" className="h-11" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={!valid || pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}

function BranchCard({ branch, onEdit }: { branch: AdminBranch; onEdit: () => void }) {
  const update = useUpdateBranch();

  function setActive(isActive: boolean) {
    update.mutate(
      { id: branch.id, isActive },
      {
        onSuccess: () => toast.success(isActive ? 'Sucursal reactivada' : 'Sucursal dada de baja'),
        onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar')),
      },
    );
  }

  return (
    <li className={cn('flex flex-wrap items-start justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-black/5', !branch.isActive && 'opacity-70')} data-testid="branch-item">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-bold">
          {branch.name} <span className="font-mono text-xs text-muted-foreground">{branch.code}</span>
          {!branch.isActive && <Pill tone="muted">De baja</Pill>}
        </p>
        <p className="text-sm text-muted-foreground">
          {branch.address}
          {branch.phone && ` · ${branch.phone}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {branch.activeStaff} {branch.activeStaff === 1 ? 'persona activa' : 'personas activas'} · {branch.openOrders} {branch.openOrders === 1 ? 'pedido sin terminar' : 'pedidos sin terminar'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Editar ${branch.name}`}>
          Editar
        </Button>
        {branch.isActive ? (
          <ConfirmButton variant="outline" size="sm" confirmLabel="Confirmar baja" disabled={update.isPending} onConfirm={() => setActive(false)} aria-label={`Dar de baja ${branch.name}`}>
            Dar de baja
          </ConfirmButton>
        ) : (
          <Button variant="outline" size="sm" disabled={update.isPending} onClick={() => setActive(true)}>
            Reactivar
          </Button>
        )}
      </div>
    </li>
  );
}

export function BranchesManager() {
  const branches = useAdminBranches();
  const [editing, setEditing] = useState<AdminBranch | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <SuperadminOnly>
      <PageHeader
        title="Sucursales"
        description="Una sucursal de baja deja de aparecer en la tienda. No se puede dar de baja la última activa ni una con pedidos sin terminar."
        actions={
          <Button
            size="lg"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <PlusIcon /> Nueva sucursal
          </Button>
        }
      />
      {branches.isPending ? (
        <ListSkeleton rows={3} />
      ) : branches.isError ? (
        <LoadError />
      ) : (
        <ul className="space-y-3" data-testid="branches-list">
          {branches.data.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              onEdit={() => {
                setEditing(branch);
                setOpen(true);
              }}
            />
          ))}
        </ul>
      )}
      <BranchDialog branch={editing} open={open} onClose={() => setOpen(false)} />
    </SuperadminOnly>
  );
}
