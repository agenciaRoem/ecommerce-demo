import { MapPinIcon, PhoneIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Container } from '@/components/store/container';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchBranches } from '@/lib/store-api';

export const metadata: Metadata = { title: 'Sucursales' };

export default function BranchesPage() {
  return (
    <Container className="space-y-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Nuestras sucursales</h1>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <BranchList />
      </Suspense>
    </Container>
  );
}

async function BranchList() {
  const branches = await fetchBranches();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {branches.map((branch) => (
        <li key={branch.id} className="space-y-2 rounded-xl bg-white p-5 ring-1 ring-black/5">
          <h2 className="font-bold">{branch.name}</h2>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            {branch.address}
          </p>
          {branch.phone && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <PhoneIcon className="size-4 shrink-0 text-brand" aria-hidden />
              {branch.phone}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
