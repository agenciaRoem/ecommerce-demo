/** Contratos de la API pública del catálogo (`/catalog/*`) y de las cuentas de clientes. */
import type { ImageUrls, Page } from './api-types';

export type AvailabilityLevel = 'in_stock' | 'low' | 'out';

export interface PriceView {
  price: string;
  listPrice: string | null;
  discountPercent: number | null;
  promotion: { id: string; name: string } | null;
}

export interface CatalogProduct {
  id: string;
  name: string;
  category: { id: string; name: string; slug: string };
  image: ImageUrls | null;
  price: PriceView;
  availability: AvailabilityLevel;
}

export interface BranchAvailability {
  id: string;
  name: string;
  address: string;
  available: number;
  level: AvailabilityLevel;
}

export interface CatalogProductDetail extends CatalogProduct {
  description: string | null;
  branches: BranchAvailability[];
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  image: ImageUrls | null;
}

export interface StoreBranch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string | null;
}

export type CatalogPage = Page<CatalogProduct>;

export type CustomerType = 'RETAIL' | 'COMMERCE';

export interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  type: CustomerType;
  phone: string | null;
  businessName: string | null;
  cuit: string | null;
  cuitVerified: boolean;
  /** El email se confirmó (enlace del correo o ingreso con Google). Sin esto no se puede comprar. */
  emailVerified: boolean;
  shippingAddress: string | null;
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'name';

export interface CatalogFilters {
  q?: string;
  category?: string;
  sort?: SortOption;
  onSale?: boolean;
  inStock?: boolean;
  page?: number;
  limit?: number;
}
