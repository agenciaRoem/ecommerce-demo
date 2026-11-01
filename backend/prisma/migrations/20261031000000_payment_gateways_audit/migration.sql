-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MERCADOPAGO');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateTable
CREATE TABLE "payment_gateways" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "PaymentMode" NOT NULL DEFAULT 'SANDBOX',
    "access_token_enc" TEXT,
    "public_key" TEXT,
    "webhook_secret_enc" TEXT,
    "account_id" TEXT,
    "account_label" TEXT,
    "site_id" TEXT,
    "last_verified_at" TIMESTAMP(3),
    "last_error" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "topic" TEXT NOT NULL,
    "action" TEXT,
    "resource_id" TEXT NOT NULL,
    "request_id" TEXT,
    "live_mode" BOOLEAN,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateways_provider_key" ON "payment_gateways"("provider");

-- CreateIndex
CREATE INDEX "payment_webhook_events_provider_received_at_idx" ON "payment_webhook_events"("provider", "received_at");

-- CreateIndex
CREATE INDEX "payment_webhook_events_provider_resource_id_idx" ON "payment_webhook_events"("provider", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_request_id_key" ON "payment_webhook_events"("provider", "request_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_created_at_idx" ON "audit_logs"("entity", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "payment_gateways" ADD CONSTRAINT "payment_gateways_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ───────── Integridad ─────────
-- Una pasarela solo puede estar activa si tiene credenciales y la clave con la que se firman los webhooks.
ALTER TABLE "payment_gateways" ADD CONSTRAINT "chk_gateway_enabled_requires_credentials"
  CHECK (NOT "is_enabled" OR ("access_token_enc" IS NOT NULL AND "webhook_secret_enc" IS NOT NULL));

-- La auditoría es inmutable: solo se agregan filas.
CREATE OR REPLACE FUNCTION forbid_audit_log_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es inmutable (operacion % no permitida)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_changes();
