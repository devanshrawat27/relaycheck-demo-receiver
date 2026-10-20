-- CreateTable
CREATE TABLE "public"."demo_orders" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "demo_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processed_events" (
    "id" SERIAL NOT NULL,
    "consumerName" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."business_effects" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_effects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_events_consumerName_eventId_key" ON "public"."processed_events"("consumerName", "eventId");

-- CreateIndex
CREATE INDEX "business_effects_orderId_idx" ON "public"."business_effects"("orderId");
