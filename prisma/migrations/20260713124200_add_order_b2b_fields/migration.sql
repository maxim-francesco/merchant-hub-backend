-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "cui" TEXT,
ADD COLUMN     "customerType" TEXT NOT NULL DEFAULT 'B2C',
ADD COLUMN     "regCom" TEXT;
