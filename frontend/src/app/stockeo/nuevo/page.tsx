import type { Metadata } from 'next';
import { NewProductForm } from '@/components/stockeo/new-product-form';

export const metadata: Metadata = { title: 'Nuevo producto' };

export default async function NewProductPage({ searchParams }: PageProps<'/stockeo/nuevo'>) {
  const { barcode } = await searchParams;
  const initialBarcode = typeof barcode === 'string' ? barcode : '';

  return (
    <>
      <h1 className="text-lg font-semibold">Nuevo producto</h1>
      {/* La key reinicia el formulario si cambia el código, porque su estado inicial se toma de la prop. */}
      <NewProductForm key={initialBarcode} initialBarcode={initialBarcode} />
    </>
  );
}
