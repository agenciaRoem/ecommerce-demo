import type { Metadata } from 'next';
import { MercadoPagoSettings } from '@/components/admin/mercadopago-settings';
import { SuperadminOnly } from '@/components/backoffice/common';

export const metadata: Metadata = { title: 'Mercado Pago' };

export default function AdminPaymentsPage() {
  return (
    <SuperadminOnly>
      <div className="max-w-3xl">
        <MercadoPagoSettings />
      </div>
    </SuperadminOnly>
  );
}
