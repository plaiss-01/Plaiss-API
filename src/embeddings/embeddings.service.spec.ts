import { EmbeddingsService } from './embeddings.service';
import { PrismaService } from '../prisma.service';
import { EMBEDDING_DIMENSIONS } from './embeddings.sql';

describe('EmbeddingsService', () => {
  let prisma: { $executeRawUnsafe: jest.Mock; $queryRawUnsafe: jest.Mock };
  let service: EmbeddingsService;

  beforeEach(() => {
    prisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    service = new EmbeddingsService(prisma as unknown as PrismaService);
  });

  it('upserts an embedding with a pgvector literal cast', async () => {
    const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0.1);
    await service.upsertEmbedding('123', 'hash-abc', embedding);

    const [sql, ...params] = prisma.$executeRawUnsafe.mock.calls.at(-1)!;
    expect(sql).toContain('ON CONFLICT (product_id)');
    expect(params[0]).toBe('123');
    expect(params[1]).toBe('hash-abc');
    expect(params[2]).toBe(`[${embedding.join(',')}]`);
  });

  it('returns [] immediately when no types are given', async () => {
    const result = await service.findSimilar([], new Array(EMBEDDING_DIMENSIONS).fill(0), 12);
    expect(result).toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('scopes the similarity query by type and orders by cosine distance', async () => {
    const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0.2);
    await service.findSimilar(['Sofa', 'Corner Sofa'], embedding, 12);

    const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls.at(-1)!;
    expect(sql).toContain('ORDER BY pe.embedding <=> $1::vector');
    expect(sql).toContain('p.product_type_clean = ANY($2::text[])');
    expect(params[0]).toBe(`[${embedding.join(',')}]`);
    expect(params[1]).toEqual(['Sofa', 'Corner Sofa']);
    expect(params[2]).toBe(12);
  });
});
