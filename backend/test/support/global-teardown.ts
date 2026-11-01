import type { Server } from 'node:http';

export default async function globalTeardown(): Promise<void> {
  const server = (globalThis as { __MP__?: Server }).__MP__;
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
}
