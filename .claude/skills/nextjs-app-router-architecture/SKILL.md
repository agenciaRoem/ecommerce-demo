---
name: nextjs-app-router-architecture
description: Arquitectura de carpetas y rutas con Next.js App Router (layouts, páginas, rutas dinámicas, loading y error). Úsalo al crear vistas nuevas o reorganizar rutas.
---

# Next.js App Router architecture

## Cuándo usar
- Al añadir una página o un layout nuevo.
- Al revisar la estructura de `app/`.

## Reglas
- Lee `app/` antes de crear una ruta; reutiliza layouts existentes.
- Usa `layout.tsx` para la estructura compartida y `loading.tsx` / `error.tsx` por segmento.
- Separa la lógica de datos (Server Components) de la interactividad (Client Components).
- Agrupa rutas relacionadas con carpetas `(grupo)` cuando compartan layout.

## Validación
- Comprueba que la navegación entre rutas funciona y que `next build` termina sin errores.
