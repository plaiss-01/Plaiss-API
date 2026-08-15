import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  ENSURE_PRODUCT_EMBEDDINGS_TABLE_SQL,
  PRODUCT_TABLE,
  toVectorLiteral,
} from './embeddings.sql';

export interface SimilarProduct {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  price: number | null;
  imageUrl: string | null;
  alternateImage: string | null;
  merchant: string | null;
  distance: number;
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  // Memoized promise rather than a boolean: two concurrent callers arriving
  // before the DDL finishes must await the *same* execution instead of both
  // racing CREATE TABLE/INDEX IF NOT EXISTS. Cleared on failure so a later
  // call retries instead of permanently re-running the full DDL block on
  // every request (e.g. if the `vector` extension isn't allow-listed).
  private tableReadyPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async ensureTable(): Promise<void> {
    if (!this.tableReadyPromise) {
      this.tableReadyPromise = this.runEnsureTableSql().catch((err) => {
        this.tableReadyPromise = null; // allow a retry on the next call rather than caching a permanent failure
        throw err;
      });
    }
    return this.tableReadyPromise;
  }

  private async runEnsureTableSql(): Promise<void> {
    for (const sql of ENSURE_PRODUCT_EMBEDDINGS_TABLE_SQL) {
      await this.prisma.$executeRawUnsafe(sql);
    }
    this.logger.log('product_embeddings table/index verified');
  }

  async upsertEmbedding(
    productId: string,
    imageHash: string,
    embedding: number[],
  ): Promise<void> {
    try {
      await this.ensureTable();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO product_embeddings (product_id, image_hash, embedding, updated_at)
         VALUES ($1, $2, $3::vector, NOW())
         ON CONFLICT (product_id)
         DO UPDATE SET image_hash = EXCLUDED.image_hash,
                        embedding = EXCLUDED.embedding,
                        updated_at = NOW()`,
        productId,
        imageHash,
        toVectorLiteral(embedding),
      );
    } catch (err) {
      this.logger.error(`Failed to upsert embedding for productId=${productId}`, err as Error);
      throw err;
    }
  }

  async findSimilar(
    types: string[],
    embedding: number[],
    limit = 12,
  ): Promise<SimilarProduct[]> {
    if (types.length === 0) return [];

    try {
      await this.ensureTable();

      return await this.prisma.$queryRawUnsafe<SimilarProduct[]>(
        `SELECT p.aw_product_id AS id,
                p.product_name AS name,
                p.slug AS slug,
                p.category_name AS category,
                p.search_price AS price,
                p.image_url AS "imageUrl",
                p.alternate_image AS "alternateImage",
                p.merchant_name AS merchant,
                pe.embedding <=> $1::vector AS distance
           FROM product_embeddings pe
           -- PRODUCT_TABLE is a fixed exported constant (embeddings.sql.ts), never
           -- request-derived — this string interpolation must NOT be extended to
           -- accept caller-supplied table/column names, or it becomes injectable.
           JOIN "${PRODUCT_TABLE}" p ON p.aw_product_id = pe.product_id
          WHERE p.product_type_clean = ANY($2::text[])
          ORDER BY pe.embedding <=> $1::vector
          LIMIT $3`,
        toVectorLiteral(embedding),
        types,
        limit,
      );
    } catch (err) {
      this.logger.error(`Failed to find similar products for types=${types.join(',')}`, err as Error);
      throw err;
    }
  }
}
