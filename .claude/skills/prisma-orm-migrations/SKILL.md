---
name: prisma-orm-migrations
description: Creación y aplicación segura de migraciones con Prisma Migrate en PostgreSQL. Úsalo al cambiar schema.prisma o al preparar migraciones para producción.
---

# Prisma ORM migrations

## Cuándo usar
- Al modificar `schema.prisma` en un cambio de modelo de datos.
- Al preparar una migración que se aplicará en producción.

## Reglas
- Genera migraciones con `prisma migrate dev` y revísalas antes de aplicarlas.
- Nunca edites migraciones ya aplicadas; crea una nueva.
- Divide los cambios destructivos (borrar columnas, cambiar tipos) en pasos: primero añadir, luego migrar datos, después eliminar.
- Usa `prisma migrate deploy` en producción.
- Haz copia de seguridad antes de cualquier migración que altere tablas productivas.

## Validación
- Aplica las migraciones en una base de datos de prueba con datos reales anonimizados.
- Ejecuta `prisma migrate status` para confirmar el estado.
