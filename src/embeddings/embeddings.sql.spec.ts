import { EMBEDDING_DIMENSIONS, toVectorLiteral } from './embeddings.sql';

describe('toVectorLiteral', () => {
  it('formats a 768-dim embedding as a pgvector literal', () => {
    const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0.5);
    expect(toVectorLiteral(embedding)).toBe(
      `[${new Array(EMBEDDING_DIMENSIONS).fill(0.5).join(',')}]`,
    );
  });

  it('throws when the embedding is the wrong length', () => {
    expect(() => toVectorLiteral([0.1, 0.2])).toThrow(
      /768/,
    );
  });
});
