-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "expectedAttributes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "phone" TEXT;
