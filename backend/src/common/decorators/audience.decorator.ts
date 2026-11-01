import { SetMetadata, applyDecorators } from '@nestjs/common';
import { Public } from './public.decorator';

export const CUSTOMER_ACCESS_KEY = 'customerAccess';

export type CustomerAccess = 'required' | 'optional';

/** Endpoint de la tienda que exige un cliente con sesión (no usa la sesión del personal). */
export const CustomerOnly = () => SetMetadata(CUSTOMER_ACCESS_KEY, 'required' satisfies CustomerAccess);

/** Endpoint público que, si hay un cliente con sesión, lo identifica (p. ej. para mostrarle sus precios). */
export const OptionalCustomer = () =>
  applyDecorators(Public(), SetMetadata(CUSTOMER_ACCESS_KEY, 'optional' satisfies CustomerAccess));
