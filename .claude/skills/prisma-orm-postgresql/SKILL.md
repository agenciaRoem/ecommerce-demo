---
name: prisma-orm-postgresql
description: Uso de Prisma ORM sobre PostgreSQL (schema.prisma, relaciones, consultas tipadas, índices). Úsalo al leer o modificar el modelo de datos o escribir consultas con Prisma.
---

# Prisma ORM with PostgreSQL

## Cuándo usar
- Al modificar `prisma/schema.prisma`.
- Al escribir o revisar consultas en los servicios.

## Reglas
- Revisa `schema.prisma` antes de cualquier cambio en modelos o relaciones.
- Usa `select` o `include` explícitos para no traer columnas sensibles.
- Reutiliza repositorios o servicios de acceso a datos existentes en lugar de consultas sueltas.
- Usa `$transaction` para operaciones que modifican varias tablas (ver `acid-transactions`).
- Declara índices en el schema para los campos que filtran frecuentemente.

## Validación
- Ejecuta `npx prisma validate` y `npx prisma format`.
- Revisa que las consultas nuevas usan índices (`EXPLAIN` en PostgreSQL).
