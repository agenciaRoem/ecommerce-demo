-- AlterEnum
ALTER TYPE "MovementReason" ADD VALUE 'SALE';

-- DropIndex
DROP INDEX "order_items_order_id_idx";

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "order_id" UUID,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "checkout_id" TEXT,
ADD COLUMN     "checkout_url" TEXT,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_id" TEXT,
ADD COLUMN     "payment_issue" TEXT,
ADD COLUMN     "payment_provider" "PaymentProvider",
ADD COLUMN     "payment_status" TEXT,
ADD COLUMN     "shipping_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sku" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_payment_provider_payment_id_key" ON "orders"("payment_provider", "payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────── Integridad de pedidos ─────────
-- Un pedido que espera el pago siempre tiene hora de vencimiento: así nunca quedan reservas sin liberar.
ALTER TABLE "orders" ADD CONSTRAINT "chk_order_pending_has_expiry"
  CHECK ("status" <> 'PENDING_PAYMENT' OR "expires_at" IS NOT NULL);

-- Los importes cierran siempre: total = subtotal + envío.
ALTER TABLE "orders" ADD CONSTRAINT "chk_order_money"
  CHECK ("subtotal" >= 0 AND "shipping_cost" >= 0 AND "total" = "subtotal" + "shipping_cost");

-- Un envío siempre tiene dirección.
ALTER TABLE "orders" ADD CONSTRAINT "chk_order_shipping_address"
  CHECK ("delivery_method" <> 'SHIPPING' OR "shipping_address" IS NOT NULL);

-- El proceso que libera reservas vencidas busca solo entre los pedidos pendientes de pago.
CREATE INDEX "orders_pending_expiry_idx" ON "orders"("expires_at") WHERE "status" = 'PENDING_PAYMENT';
