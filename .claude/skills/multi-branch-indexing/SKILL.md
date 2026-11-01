---
name: multi-branch-indexing
description: Índices compuestos para consultas multi-sucursal (branch_id combinado con fechas, estados o productos). Úsalo al diseñar índices para tablas filtradas por sucursal.
---

# Multi-branch indexing

## Cuándo usar
- Al diseñar índices para tablas consultadas por sucursal.
- Al revisar consultas lentas que filtran por `branch_id`.

## Reglas
- Coloca `branch_id` como primera columna del índice compuesto cuando casi todas las consultas lo filtran.
- Añade después las columnas de filtro o de orden más usadas (fecha, estado).
- Reutiliza índices existentes; no añadas uno que ya cubre la consulta por prefijo.
- Usa índices parciales para estados muy selectivos (por ejemplo, solo stock activo).

## Validación
- Confirma con `EXPLAIN` que la consulta usa el índice (`Index Scan` o `Index Only Scan`).
