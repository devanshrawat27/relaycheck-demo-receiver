-- DropIndex
DROP INDEX "public"."business_effects_orderId_key";

-- CreateIndex
CREATE INDEX "business_effects_orderId_idx" ON "public"."business_effects"("orderId");
