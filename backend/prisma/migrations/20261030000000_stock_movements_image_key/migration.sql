-- CreateEnum
CREATE TYPE "MovementReason" AS ENUM ('INITIAL', 'INTAKE', 'ADJUSTMENT');

-- AlterTable
-- Se renombra (no se recrea) para conservar los datos existentes.
ALTER TABLE "products" RENAME COLUMN "image_url" TO "image_key";

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "MovementReason" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_branch_id_created_at_idx" ON "stock_movements"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_branch_id_created_at_idx" ON "stock_movements"("product_id", "branch_id", "created_at");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────── Integridad ─────────
ALTER TABLE "stock_movements" ADD CONSTRAINT "chk_stock_movement_delta" CHECK ("delta" <> 0);

-- El historial de movimientos es inmutable: solo se agregan filas.
CREATE OR REPLACE FUNCTION forbid_stock_movement_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements es inmutable (operacion % no permitida)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movements_immutable
  BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION forbid_stock_movement_changes();
