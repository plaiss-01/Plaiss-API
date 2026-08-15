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
  private tableReady = false;

  constructor(private readonly prisma: PrismaService) {}

  async ensureTable(): Promise<void> {
    if (this.tableReady) return;
    for (const sql of ENSURE_PRODUCT_EMBEDDINGS_TABLE_SQL) {
      await this.prisma.$executeRawUnsafe(sql);
    }
    this.tableReady = true;
    this.logger.log('product_embeddings table/index verified');
  }

  async upsertEmbedding(
    productId: string,
    imageHash: string,
    embedding: number[],
  ): Promise<void> {
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
  }

  async findSimilar(
    types: string[],
    embedding: number[],
    limit = 12,
  ): Promise<SimilarProduct[]> {
    if (types.length === 0) return [];

    await this.ensureTable();

    return this.prisma.$queryRawUnsafe<SimilarProduct[]>(
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
         JOIN "${PRODUCT_TABLE}" p ON p.aw_product_id = pe.product_id
        WHERE p.product_type_clean = ANY($2::text[])
        ORDER BY pe.embedding <=> $1::vector
        LIMIT $3`,
      toVectorLiteral(embedding),
      types,
      limit,
    );
  }
}
