-- CreateTable
CREATE TABLE "public"."fault_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "delayMs" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fault_config_pkey" PRIMARY KEY ("id")
);
