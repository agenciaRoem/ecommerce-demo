'use client';

import { PlusIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ListSkeleton, LoadError, PageHeader, Pager } from '@/components/backoffice/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Product } from '@/lib/api-types';
import { useDebouncedValue } from '@/lib/hooks';
import { useProductList } from '@/lib/products-admin';
import { cn } from '@/lib/utils';
import { ProductThumb } from '../stockeo/product-thumb';
import { ProductDialog } from './product-dialog';

export function ProductsManager() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [page, setPage] = useState(1);
  const products = useProductList(search, page);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  function openDialog(product: Product | null) {
    setEditing(product);
    setOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Productos"
        description="Da de alta productos nuevos y corregí los datos de los que ya están: nombre, código, categoría, descripción y foto."
        actions={
          <Button size="lg" onClick={() => openDialog(null)}>
            <PlusIcon /> Nuevo producto
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Buscar producto"
          placeholder="Nombre, SKU o código de barras"
          className="h-10 pl-9"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {products.isPending ? (
        <ListSkeleton />
      ) : products.isError ? (
        <LoadError />
      ) : products.data.items.length === 0 ? (
        <EmptyState>No hay productos con ese criterio.</EmptyState>
      ) : (
        <div className={cn('space-y-2', products.isPlaceholderData && 'opacity-60')}>
          <ul className="divide-y rounded-xl bg-white ring-1 ring-black/5" data-testid="products-list">
            {products.data.items.map((product) => (
              <li key={product.id} className="flex items-center gap-3 p-3" data-testid="product-item">
                <ProductThumb image={product.image} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{product.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {product.sku} · {product.category.name}
                    {product.barcode && ` · ${product.barcode}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openDialog(product)} aria-label={`Editar ${product.name}`}>
                  Editar
                </Button>
              </li>
            ))}
          </ul>
          <Pager page={page} limit={products.data.limit} total={products.data.total} onPage={setPage} disabled={products.isPlaceholderData} />
        </div>
      )}

      <ProductDialog product={editing} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
