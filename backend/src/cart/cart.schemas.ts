import { z } from 'zod';
import { CART_MAX_QUANTITY } from './cart.service';

const quantity = z.number().int().min(1).max(CART_MAX_QUANTITY);

export const addCartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity,
});

export const setCartItemSchema = z.object({
  /** 0 quita el producto. */
  quantity: z.number().int().min(0).max(CART_MAX_QUANTITY),
});

export const cartViewQuerySchema = z.object({ branchId: z.string().uuid().optional() });

export const productParamSchema = z.string().uuid();

export type AddCartItemDto = z.infer<typeof addCartItemSchema>;
export type SetCartItemDto = z.infer<typeof setCartItemSchema>;
export type CartViewQuery = z.infer<typeof cartViewQuerySchema>;
