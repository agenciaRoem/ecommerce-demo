-- El valor del enum se usa en una migración aparte: PostgreSQL no permite usarlo en la misma transacción que lo crea.
INSERT INTO "roles" ("id", "name", "description")
SELECT gen_random_uuid(), 'ENCARGADO_STOCK', 'Alta y edición de productos'
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'ENCARGADO_STOCK');
