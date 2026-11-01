---
name: client-server-components
description: Separación entre Server Components y Client Components en Next.js, con uso justificado de "use client". Úsalo al decidir dónde ubicar un componente o al añadir interactividad.
---

# Client and Server Components

## Cuándo usar
- Al crear un componente nuevo y decidir si necesita interactividad.
- Al revisar un `"use client"` existente.

## Reglas
- Por defecto un componente es Server Component; no añadas `"use client"` sin necesidad.
- Añade `"use client"` solo si usa estado, efectos, eventos del navegador o hooks de cliente.
- Pasa datos desde Server Components a Client Components por props serializables.
- Mantén el `"use client"` en las hojas del árbol, no en layouts completos.

## Validación
- Revisa que ningún Server Component importa hooks de cliente y que el bundle no incluye código de servidor.
