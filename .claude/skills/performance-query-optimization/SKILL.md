---
name: performance-query-optimization
description: Optimización de consultas SQL y Prisma (eliminar N+1, paginación, índices, planes de ejecución). Úsalo al investigar consultas lentas o al revisar nuevas consultas complejas.
---

# Performance query optimization

## Cuándo usar
- Cuando una petición tarda más de lo esperado.
- Al revisar consultas nuevas que recorren muchas filas.

## Reglas
- Busca consultas N+1 y reemplázalas por `include` o una consulta agrupada.
- Pagina siempre las listas; nunca devuelvas tablas completas.
- Selecciona solo las columnas necesarias con `select`.
- Mide antes de optimizar: `EXPLAIN (ANALYZE, BUFFERS)` y logs de consultas lentas (`log_min_duration_statement`).
- Evita funciones sobre columnas indexadas en el `WHERE`.

## Validación
- Compara tiempo y número de consultas antes y después del cambio.
