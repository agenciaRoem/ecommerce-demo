-- Verificación del email de los clientes.
ALTER TABLE "customers" ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- Las cuentas que ya existían se dan por verificadas: no se les puede pedir de golpe un paso que no existía.
UPDATE "customers" SET "email_verified_at" = "created_at";
