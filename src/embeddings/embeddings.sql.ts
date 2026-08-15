// Shared SQL + formatting for product_embeddings. Imported by both
// EmbeddingsService (request path) and scripts/backfill-embeddings.ts (the
// standalone catalogue job), so the table/index definition and the vector
// literal format have exactly one source of truth.

// Same table Product maps to (prisma/schema.prisma `@@map`). Fixed
// constant, matches the pattern already used in scripts/backfill-material.ts.
export const PRODUCT_TABLE = 'AWIN_AFFILIAT_PRODUCTS_DATA_PROD';

// DINOv2 ViT-B/14, per Raph 2026-08-15.
export const EMBEDDING_DIMENSIONS = 768;

export function toVectorLiteral(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected a ${EMBEDDING_DIMENSIONS}-dimension embedding, got ${embedding.length}`,
    );
  }
  return `[${embedding.join(',')}]`;
}

// Deliberately NOT in schema.prisma: `prisma db push` runs on every boot
// (non-fatal on failure, see start.sh) and actively destroys indexes not
// declared in schema.prisma on tables Prisma DOES model — that's why
// awin.controller.ts has ensureSearchIndexes(). Since product_embeddings has
// NO Prisma model at all, db push cannot act on it. Accessed purely via
// $executeRawUnsafe/$queryRawUnsafe.
export const ENSURE_PRODUCT_EMBEDDINGS_TABLE_SQL = [
  `CREATE EXTENSION IF NOT EXISTS vector`,
  `CREATE TABLE IF NOT EXISTS product_embeddings (
     product_id TEXT PRIMARY KEY,
     image_hash TEXT NOT NULL,
     embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_product_embeddings_hnsw
     ON product_embeddings USING hnsw (embedding vector_cosine_ops)
     WITH (m = 16, ef_construction = 64)`,
];
