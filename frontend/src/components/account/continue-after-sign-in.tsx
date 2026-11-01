'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { customerKey, markCustomerSession } from '@/lib/customer-session';

export function ContinueAfterSignIn({ next }: { next: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    markCustomerSession();
    void queryClient.invalidateQueries({ queryKey: customerKey });
    router.replace(next);
    router.refresh(); // el servidor vuelve a renderizar con los precios del cliente
  }, [next, queryClient, router]);

  return (
    <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden /> Ingresando a tu cuenta…
    </p>
  );
}
