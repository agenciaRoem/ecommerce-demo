---
name: data-integrity
description: Integridad de datos con restricciones en la base de datos, validaciones y auditoría de cambios. Úsalo al añadir reglas de negocio que deben cumplirse siempre, como stock no negativo o unicidad por sucursal.
---

# Data integrity

## Cuándo usar
- Al definir reglas de negocio sobre los datos.
- Al revisar si una regla depende solo de la aplicación.

## Reglas
- Las reglas críticas se implementan como restricciones en la base de datos (`CHECK`, `UNIQUE`, claves foráneas).
- Por ejemplo, `CHECK (stock >= 0)` y `UNIQUE (branch_id, sku)`.
- Registra cambios sensibles de stock en una tabla de movimientos, sin sobrescribir el historial.
- No borres datos de negocio; marca registros como inactivos.

## Validación
- Intenta violar cada restricción y confirma que la base de datos la rechaza.
