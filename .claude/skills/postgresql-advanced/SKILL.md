---
name: postgresql-advanced
description: Funcionalidades avanzadas de PostgreSQL (tipos, constraints, vistas, funciones, planes de ejecución). Úsalo al diseñar o revisar esquemas y consultas complejas sobre PostgreSQL.
---

# PostgreSQL advanced

## Cuándo usar
- Al diseñar tablas con restricciones complejas.
- Al optimizar consultas que tardan o consumen mucha memoria.

## Reglas
- Usa tipos adecuados (`numeric` para dinero, `timestamptz` para fechas, `uuid` para identificadores).
- Define `CHECK`, `UNIQUE` y `NOT NULL` en la base de datos, no solo en la aplicación.
- Usa `EXPLAIN (ANALYZE, BUFFERS)` antes de proponer un índice.
- Prefiere vistas o funciones solo cuando reducen duplicación real.

## Validación
- Compara el plan de ejecución antes y después del cambio.
