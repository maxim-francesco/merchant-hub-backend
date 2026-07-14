-- AlterTable
ALTER TABLE "Product" ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "stockDecremented" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: Copy attributes.stock -> stock column
UPDATE "Product"
SET "stock" = CASE
  WHEN attributes IS NOT NULL AND attributes ? 'stock' AND attributes->>'stock' ~ '^[0-9]+$'
  THEN (attributes->>'stock')::int
  ELSE 0
END;

-- Drop the key: Remove 'stock' from attributes JSONB
UPDATE "Product"
SET "attributes" = CASE
  WHEN attributes IS NOT NULL THEN attributes - 'stock'
  ELSE '{}'::jsonb
END;
