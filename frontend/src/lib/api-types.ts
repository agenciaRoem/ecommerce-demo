/** Contratos de la API del backend (espejo de sus respuestas). */

export type Role = 'SUPERADMIN' | 'GERENTE' | 'SALA' | 'STOCKEO' | 'ENCARGADO_STOCK';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  branchId: string | null;
  branchName: string | null;
}

export interface ImageUrls {
  thumb: string;
  card: string;
  detail: string;
}

export interface UploadedImage {
  imageKey: string;
  urls: ImageUrls;
}

export interface StockLevel {
  stock: number;
  reserved: number;
  available: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: { id: string; name: string };
  image: ImageUrls | null;
  cost?: string;
  retailPrice: string;
  wholesalePrice: string;
  stock: StockLevel;
}

export interface InventoryRow extends StockLevel {
  branchId: string;
  product: { id: string; sku: string; barcode: string | null; name: string; image: ImageUrls | null };
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateProductInput {
  name: string;
  barcode?: string;
  categoryId: string;
  cost: number;
  quantity: number;
  description?: string;
  imageKey?: string;
}
