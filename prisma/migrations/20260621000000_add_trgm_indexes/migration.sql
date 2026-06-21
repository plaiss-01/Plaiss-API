-- Enable trigram extension for fast ILIKE queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes on Product columns used with ILIKE/contains
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_category_trgm_idx"
  ON "Product" USING GIN (category_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_merchant_category_trgm_idx"
  ON "Product" USING GIN (merchant_category gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING GIN (name gin_trgm_ops);
