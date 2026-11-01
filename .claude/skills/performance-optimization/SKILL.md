---
name: performance-optimization
description: Optimización de rendimiento en Next.js y React (bundle, imágenes, carga diferida, re-renders innecesarios). Úsalo al revisar la velocidad de una vista o el tamaño del bundle.
---

# Performance optimization

## Cuándo usar
- Cuando una vista carga o responde lento.
- Al añadir dependencias grandes o componentes pesados.

## Reglas
- Carga componentes pesados con `next/dynamic` o `React.lazy`.
- Usa `next/image` con dimensiones definidas para imágenes.
- Evita re-renders innecesarios con `memo`, `useMemo` o `useCallback` solo donde se haya medido el problema.
- Revisa el tamaño del bundle antes de añadir una librería; prefiere las ya instaladas.

## Validación
- Ejecuta `next build` y compara el tamaño de las rutas antes y después del cambio.
