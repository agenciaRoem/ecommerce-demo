-- CreateTable
CREATE TABLE "order_status_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_status_events_order_id_created_at_idx" ON "order_status_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_status_events_user_id_created_at_idx" ON "order_status_events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────── Integridad ─────────
-- El historial de estados es inmutable: solo se agregan filas.
CREATE OR REPLACE FUNCTION forbid_order_event_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'order_status_events es inmutable (operacion % no permitida)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_status_events_immutable
  BEFORE UPDATE OR DELETE ON "order_status_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_order_event_changes();

-- Un cambio de estado siempre cambia algo.
ALTER TABLE "order_status_events" ADD CONSTRAINT "chk_order_event_changes_status"
  CHECK ("from_status" IS DISTINCT FROM "to_status");

-- Los pedidos que ya existían reciben un primer evento para que su línea de tiempo no arranque vacía.
INSERT INTO "order_status_events" ("id", "order_id", "from_status", "to_status", "note", "created_at")
SELECT gen_random_uuid(), "id", NULL, "status", 'Estado inicial al activar el historial', "created_at" FROM "orders";
