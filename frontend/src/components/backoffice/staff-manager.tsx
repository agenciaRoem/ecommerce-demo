'use client';

import { PlusIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import type { Role } from '@/lib/api-types';
import { ROLE_LABEL, StaffFilters, StaffMember, useAdminBranches, useCreateStaff, useResetPassword, useStaff, useUpdateStaff } from '@/lib/backoffice/administration';
import { useDebouncedValue } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { EmptyState, Field, ListSkeleton, LoadError, PageHeader, Pager, Pill, SuperadminOnly, errorMessage, fieldErrors } from './common';

const ROLES = Object.keys(ROLE_LABEL) as Role[];
const ROLE_HELP: Record<Role, string> = {
  SUPERADMIN: 'Acceso total. No pertenece a una sucursal.',
  GERENTE: 'Métricas, precios y promociones de su sucursal.',
  SALA: 'Prepara y entrega los pedidos de su sucursal.',
  STOCKEO: 'Carga mercadería y stock de su sucursal.',
  ENCARGADO_STOCK: 'Solo da de alta y edita productos (sin precios ni stock).',
};

function PasswordField({ id, value, onChange, error }: { id: string; value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <Field label="Contraseña" htmlFor={id} hint="Mínimo 10 caracteres. Pasásela por un canal seguro: la persona puede cambiarla luego." error={error}>
      <Input id={id} type="text" autoComplete="off" className="h-11 font-mono" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function StaffDialog({ member, open, onClose }: { member: StaffMember | null; open: boolean; onClose: () => void }) {
  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="staff-dialog-title" className="w-[min(94vw,32rem)]">
      {open && <StaffForm key={member?.id ?? 'new'} member={member} onClose={onClose} />}
    </ModalDialog>
  );
}

function StaffForm({ member, onClose }: { member: StaffMember | null; onClose: () => void }) {
  const branches = useAdminBranches();
  const create = useCreateStaff();
  const update = useUpdateStaff();
  const { data: me } = useSession();

  const [fullName, setFullName] = useState(member?.fullName ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(member?.role ?? 'SALA');
  const [branchId, setBranchId] = useState(member?.branch?.id ?? '');

  const isSelf = member?.id === me?.id;
  const needsBranch = role !== 'SUPERADMIN';
  const pending = create.isPending || update.isPending;
  const errors = fieldErrors(create.error ?? update.error);
  const valid = fullName.trim().length >= 2 && (member !== null || (/^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= 10)) && (!needsBranch || branchId !== '');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const done = {
      onSuccess: () => {
        toast.success(member ? 'Cambios guardados' : 'Usuario creado');
        onClose();
      },
      onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo guardar')),
    };
    if (member) update.mutate({ id: member.id, fullName: fullName.trim(), role, branchId: needsBranch ? branchId : null }, done);
    else create.mutate({ email: email.trim(), fullName: fullName.trim(), password, role, branchId: needsBranch ? branchId : undefined }, done);
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <h2 id="staff-dialog-title" className="text-lg font-extrabold">
        {member ? `Editar a ${member.fullName}` : 'Nuevo usuario del personal'}
      </h2>
      <Field label="Nombre completo" htmlFor="staff-name" error={errors.fullName}>
        <Input id="staff-name" className="h-11" maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label="Email" htmlFor="staff-email" hint={member ? 'El email no se puede cambiar.' : 'Con este email ingresa al sistema.'} error={errors.email}>
        <Input id="staff-email" type="email" autoComplete="off" className="h-11" value={email} disabled={member !== null} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {!member && <PasswordField id="staff-password" value={password} onChange={setPassword} error={errors.password} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rol" htmlFor="staff-role" hint={ROLE_HELP[role]} error={errors.role}>
          <NativeSelect id="staff-role" className="h-11" value={role} disabled={isSelf} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABEL[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {needsBranch && (
          <Field label="Sucursal" htmlFor="staff-branch" error={errors.branchId}>
            <NativeSelect id="staff-branch" className="h-11" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Elegí una sucursal…</option>
              {branches.data?.filter((branch) => branch.isActive || branch.id === member?.branch?.id).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      {member && (
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          {isSelf ? 'No podés cambiarte el rol a vos mismo.' : 'Si cambiás el rol o la sucursal, se cierran sus sesiones abiertas y entra de nuevo con los permisos nuevos.'}
        </p>
      )}
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

function PasswordDialog({ member, onClose }: { member: StaffMember | null; onClose: () => void }) {
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const errors = fieldErrors(reset.error);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!member || password.length < 10) return;
    reset.mutate(
      { id: member.id, password },
      {
        onSuccess: () => {
          toast.success('Contraseña cambiada. Se cerraron sus sesiones.');
          setPassword('');
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar')),
      },
    );
  }

  return (
    <ModalDialog open={member !== null} onClose={onClose} labelledBy="password-dialog-title" className="w-[min(94vw,28rem)]">
      {member && (
        <form onSubmit={submit} className="space-y-4 p-5">
          <h2 id="password-dialog-title" className="text-lg font-extrabold">
            Nueva contraseña para {member.fullName}
          </h2>
          <PasswordField id="reset-password" value={password} onChange={setPassword} error={errors.password} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={password.length < 10 || reset.isPending}>
              {reset.isPending ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}

function StaffRow({ member, isSelf, onEdit, onPassword }: { member: StaffMember; isSelf: boolean; onEdit: () => void; onPassword: () => void }) {
  const update = useUpdateStaff();

  function setActive(isActive: boolean) {
    update.mutate(
      { id: member.id, isActive },
      {
        onSuccess: () => toast.success(isActive ? 'Usuario reactivado' : 'Usuario dado de baja'),
        onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar')),
      },
    );
  }

  return (
    <li className={cn('flex flex-wrap items-center justify-between gap-3 p-3', !member.isActive && 'opacity-60')} data-testid="staff-item">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {member.fullName} {isSelf && <span className="text-xs font-normal text-muted-foreground">(vos)</span>}
          <Pill tone={member.role === 'SUPERADMIN' ? 'info' : 'muted'}>{ROLE_LABEL[member.role]}</Pill>
          {!member.isActive && <Pill tone="warn">De baja</Pill>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {member.email} · {member.branch?.name ?? 'Todas las sucursales'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Editar a ${member.fullName}`}>
          Editar
        </Button>
        <Button variant="outline" size="sm" onClick={onPassword} aria-label={`Cambiar la contraseña de ${member.fullName}`}>
          Contraseña
        </Button>
        {!isSelf &&
          (member.isActive ? (
            <ConfirmButton variant="outline" size="sm" confirmLabel="Confirmar baja" disabled={update.isPending} onConfirm={() => setActive(false)} aria-label={`Dar de baja a ${member.fullName}`}>
              Dar de baja
            </ConfirmButton>
          ) : (
            <Button variant="outline" size="sm" disabled={update.isPending} onClick={() => setActive(true)}>
              Reactivar
            </Button>
          ))}
      </div>
    </li>
  );
}

export function StaffManager() {
  const { data: me } = useSession();
  const branches = useAdminBranches();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [filters, setFilters] = useState<Omit<StaffFilters, 'search' | 'page'>>({ role: '', branchId: '', status: 'all' });
  const [page, setPage] = useState(1);
  const staff = useStaff({ ...filters, search, page });
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [passwordFor, setPasswordFor] = useState<StaffMember | null>(null);

  const filter = (patch: Partial<typeof filters>) => {
    setFilters({ ...filters, ...patch });
    setPage(1);
  };

  return (
    <SuperadminOnly>
      <PageHeader
        title="Personal"
        description="Altas, roles y bajas del equipo. Una baja cierra sus sesiones al instante en el siguiente uso; el acceso ya abierto puede durar hasta 15 minutos."
        actions={
          <Button
            size="lg"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon /> Nuevo usuario
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Buscar personal"
            placeholder="Nombre o email"
            className="h-10 pl-9"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <NativeSelect aria-label="Rol" className="h-10 w-40 text-sm" value={filters.role} onChange={(e) => filter({ role: e.target.value as Role | '' })}>
          <option value="">Todos los roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Sucursal" className="h-10 w-48 text-sm" value={filters.branchId} onChange={(e) => filter({ branchId: e.target.value })}>
          <option value="">Todas las sucursales</option>
          {branches.data?.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Estado" className="h-10 w-40 text-sm" value={filters.status} onChange={(e) => filter({ status: e.target.value as StaffFilters['status'] })}>
          <option value="all">Activos y de baja</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo de baja</option>
        </NativeSelect>
      </div>

      {staff.isPending ? (
        <ListSkeleton />
      ) : staff.isError ? (
        <LoadError />
      ) : staff.data.items.length === 0 ? (
        <EmptyState>No hay personal con esos filtros.</EmptyState>
      ) : (
        <div className={cn('space-y-2', staff.isPlaceholderData && 'opacity-60')}>
          <ul className="divide-y rounded-xl bg-white ring-1 ring-black/5" data-testid="staff-list">
            {staff.data.items.map((member) => (
              <StaffRow
                key={member.id}
                member={member}
                isSelf={member.id === me?.id}
                onEdit={() => {
                  setEditing(member);
                  setFormOpen(true);
                }}
                onPassword={() => setPasswordFor(member)}
              />
            ))}
          </ul>
          <Pager page={page} limit={staff.data.limit} total={staff.data.total} onPage={setPage} disabled={staff.isPlaceholderData} />
        </div>
      )}

      <StaffDialog member={editing} open={formOpen} onClose={() => setFormOpen(false)} />
      <PasswordDialog member={passwordFor} onClose={() => setPasswordFor(null)} />
    </SuperadminOnly>
  );
}
