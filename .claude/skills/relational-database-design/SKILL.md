---
name: relational-database-design
description: Diseño de bases de datos relacionales (normalización, claves foráneas, integridad referencial). Úsalo al crear nuevas entidades o relaciones, o al revisar campos duplicados.
---

# Relational database design

## Cuándo usar
- Al añadir una entidad o una relación al modelo.
- Al detectar datos duplicados o inconsistentes.

## Reglas
- Normaliza hasta la tercera forma normal salvo que haya una razón de rendimiento documentada.
- Cada relación tiene clave foránea con la acción de borrado explícita (`RESTRICT`, `CASCADE` o `SET NULL`).
- No dupliques campos entre tablas; referencia la fila original.
- Revisa el impacto de cada cambio en las consultas existentes antes de alterar una relación.

## Validación
- Intenta insertar una fila huérfana y confirma que la base de datos la rechaza.
