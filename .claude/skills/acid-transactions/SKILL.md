---
name: acid-transactions
description: Transacciones ACID con Prisma y PostgreSQL para operaciones atómicas, especialmente inventario y movimientos entre sucursales. Úsalo al modificar varias filas o tablas en una misma operación de negocio.
---

# ACID transactions

## Cuándo usar
- Al descontar o mover stock, registrar ventas o transferir entre sucursales.
- Al escribir operaciones que tocan más de una tabla.

## Reglas
- Envuelve en `prisma.$transaction` cualquier operación que modifique varias filas o tablas.
- Nunca dejes una operación de inventario a medias: todo se confirma o todo se revierte.
- Para stock concurrente, usa bloqueo pesimista (`SELECT ... FOR UPDATE`) o actualizaciones condicionales.
- Mantén las transacciones cortas; no llames a servicios externos dentro de ellas.

## Validación
- Simula un fallo a mitad de la operación y confirma que no quedan cambios parciales.
- Lanza peticiones concurrentes sobre el mismo producto y verifica que el stock no queda negativo.
