---
name: advanced-typescript-patterns
description: Patrones avanzados de TypeScript para frontend (genéricos, tipos utilitarios, discriminated unions, tipado de props). Úsalo al modelar tipos de componentes, hooks o respuestas de API.
---

# Advanced TypeScript patterns

## Cuándo usar
- Al tipar props, hooks o respuestas de API complejas.
- Al revisar código con `any` o casts innecesarios.

## Reglas
- Usa `strict` y evita `any`; si el tipo es desconocido, usa `unknown` y valida.
- Modela estados con discriminated unions (`status: 'idle' | 'loading' | 'success' | 'error'`).
- Usa `Pick`, `Omit` y `Partial` para derivar tipos en lugar de duplicarlos.
- Tipa las props con interfaces exportadas y reutilizables.

## Validación
- Ejecuta `tsc --noEmit` sin errores.
