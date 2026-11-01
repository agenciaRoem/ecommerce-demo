---
name: acid-transactions-concurrency
description: Control de concurrencia con transacciones ACID y bloqueos optimistas o pesimistas para evitar sobreventas de stock. Úsalo al modificar saldos o inventario que se actualizan desde varias terminales a la vez.
---

# ACID transactions and concurrency

## Cuándo usar
- Al descontar stock desde varias terminales de venta.
- Al revisar condiciones de carrera en operaciones de inventario.

## Reglas
- Bloqueo pesimista (`SELECT ... FOR UPDATE`) cuando la contención es alta.
- Bloqueo optimista (columna `version` con condición en el `UPDATE`) cuando la contención es baja.
- Actualiza el stock con expresiones atómicas (`stock = stock - $1`) con condición `stock >= $1`.
- Nivel de aislamiento por defecto (`READ COMMITTED`); sube a `SERIALIZABLE` solo con justificación.

## Validación
- Lanza ventas concurrentes sobre el mismo producto y verifica que la suma de ventas nunca supera el stock inicial.
