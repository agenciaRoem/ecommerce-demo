-- CreateTable
CREATE TABLE "product_price_changes" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "user_id" UUID,
    "old_cost" DECIMAL(12,2) NOT NULL,
    "new_cost" DECIMAL(12,2) NOT NULL,
    "old_retail" DECIMAL(12,2) NOT NULL,
    "new_retail" DECIMAL(12,2) NOT NULL,
    "old_wholesale" DECIMAL(12,2) NOT NULL,
    "new_wholesale" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_price_changes_product_id_created_at_idx" ON "product_price_changes"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "product_price_changes_created_at_idx" ON "product_price_changes"("created_at");

-- AddForeignKey
ALTER TABLE "product_price_changes" ADD CONSTRAINT "product_price_changes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_changes" ADD CONSTRAINT "product_price_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────── Integridad ─────────
-- El historial de precios es inmutable: solo se agregan filas.
CREATE OR REPLACE FUNCTION forbid_price_change_edits() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'product_price_changes es inmutable (operacion % no permitida)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_price_changes_immutable
  BEFORE UPDATE OR DELETE ON "product_price_changes"
  FOR EACH ROW EXECUTE FUNCTION forbid_price_change_edits();

-- Un registro de cambio siempre cambia algo y nunca guarda valores negativos.
ALTER TABLE "product_price_changes"
  ADD CONSTRAINT "chk_price_change_non_negative" CHECK (
    "old_cost" >= 0 AND "new_cost" >= 0 AND "old_retail" >= 0 AND "new_retail" >= 0
    AND "old_wholesale" >= 0 AND "new_wholesale" >= 0),
  ADD CONSTRAINT "chk_price_change_differs" CHECK (
    "old_cost" <> "new_cost" OR "old_retail" <> "new_retail" OR "old_wholesale" <> "new_wholesale");

-- ───────── Métricas ─────────
-- Las ventas se consultan por fecha de pago y sucursal; solo interesan los pedidos ya pagados.
CREATE INDEX "orders_paid_at_idx" ON "orders"("paid_at") WHERE "paid_at" IS NOT NULL;
CREATE INDEX "orders_branch_id_paid_at_idx" ON "orders"("branch_id", "paid_at") WHERE "paid_at" IS NOT NULL;
