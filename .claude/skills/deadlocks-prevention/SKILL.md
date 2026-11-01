---
name: deadlocks-prevention
description: Prevención y diagnóstico de deadlocks en PostgreSQL al actualizar varias filas o tablas concurrentemente. Úsalo al revisar transacciones que bloquean filas de inventario o sucursales.
---

# Deadlocks prevention

## Cuándo usar
- Al ver errores `deadlock detected` en los logs.
- Al diseñar transacciones que tocan varias filas o tablas.

## Reglas
- Adquiere los bloqueos siempre en el mismo orden (por ejemplo, por `id` ascendente).
- Mantén las transacciones cortas y sin llamadas externas.
- Reintenta la transacción ante `40P01` con un número limitado de intentos y backoff.
- Usa `SELECT ... FOR UPDATE` con `NOWAIT` o `SKIP LOCKED` cuando sea apropiado.

## Validación
- Provoca concurrencia sobre filas solapadas y confirma que no aparece `deadlock detected`.
