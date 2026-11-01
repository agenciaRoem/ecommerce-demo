import { Suspense, type ReactNode } from 'react';
import { AuthSync } from '@/components/store/auth-sync';
import { StoreFooter } from '@/components/store/store-footer';
import { StoreHeader, StoreHeaderSkeleton } from '@/components/store/store-header';

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <Suspense fallback={<StoreHeaderSkeleton />}>
        <StoreHeader />
      </Suspense>
      <main className="flex-1">{children}</main>
      <StoreFooter />
      <AuthSync />
    </div>
  );
}
