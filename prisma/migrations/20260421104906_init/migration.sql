-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "awinId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL,
    "currency" TEXT,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "merchant" TEXT,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_awinId_key" ON "Product"("awinId");
