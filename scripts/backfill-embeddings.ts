/**
 * Backfills product_embeddings for every catalogue product whose image is
 * new or has changed, using the SAME RunPod detection endpoint the live
 * Engine uses (embed_only mode - see detection-runpod/handler.py) so
 * catalogue and query embeddings share identical model + preprocessing.
 *
 * Image "changed" = the product's image_url has changed since it was last
 * embedded (hashed here, not fetched byte-for-byte - a re-import that
 * changes a photo always changes the URL, and hashing every catalogue image
 * body would be far more expensive for no extra signal).
 *
 * Concurrency is capped at 2 in-flight RunPod calls to match the endpoint's
 * current max workers (4xecm810lylvnt, maxWorkers=2) - going higher just
 * queues, it doesn't go faster.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/backfill-embeddings.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/backfill-embeddings.ts --limit 50
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/backfill-embeddings.ts
 *
 * Requires DATABASE_URL, RUNPOD_ENDPOINT_ID, RUNPOD_API_KEY in the
 * environment (same RunPod credentials the frontend uses).
 */
import { createHash } from 'crypto';
import { Client } from 'pg';
import {
  ENSURE_PRODUCT_EMBEDDINGS_TABLE_SQL,
  PRODUCT_TABLE,
  toVectorLiteral,
} from '../src/embeddings/embeddings.sql';

const RUNPOD_API = 'https://api.runpod.ai/v2';
const CONCURRENCY = 2;
const dryRun = process.argv.includes('--dry-run');
const limitArgIndex = process.argv.indexOf('--limit');
const limit =
  limitArgIndex !== -1
    ? parseInt(process.argv[limitArgIndex + 1], 10)
    : undefined;

function imageHash(imageUrl: string): string {
  return createHash('sha256').update(imageUrl).digest('hex');
}

async function embedImage(imageUrl: string): Promise<number[]> {
  const endpoint = process.env.RUNPOD_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error('RUNPOD_ENDPOINT_ID / RUNPOD_API_KEY are not set');
  }

  const response = await fetch(`${RUNPOD_API}/${endpoint}/runsync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: { embed_only: true, image_url: imageUrl } }),
  });

  if (!response.ok) {
    throw new Error(`RunPod embed failed: HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    status: string;
    output?: { success: boolean; embedding?: number[] };
  };

  if (
    body.status !== 'COMPLETED' ||
    !body.output?.success ||
    !body.output.embedding
  ) {
    throw new Error(
      `RunPod embed job did not complete: ${JSON.stringify(body)}`,
    );
  }

  return body.output.embedding;
}

// Tiny fixed-size worker pool - no new dependency, matches this repo's
// no-unnecessary-deps style (fetch is already global in this Node version).
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    await worker(items[index], index);
    await next();
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()));
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (!dryRun) {
      for (const sql of ENSURE_PRODUCT_EMBEDDINGS_TABLE_SQL) {
        await client.query(sql);
      }
    }

    const { rows: products } = await client.query<{
      id: string;
      image_url: string;
    }>(
      `SELECT aw_product_id AS id, image_url
         FROM "${PRODUCT_TABLE}"
        WHERE image_url IS NOT NULL AND image_url <> ''`,
    );

    const { rows: existing } = await client.query<{
      product_id: string;
      image_hash: string;
    }>(`SELECT product_id, image_hash FROM product_embeddings`);
    const existingHashes = new Map(
      existing.map((r) => [r.product_id, r.image_hash]),
    );

    let stale = products.filter(
      (p) => existingHashes.get(p.id) !== imageHash(p.image_url),
    );
    if (limit) stale = stale.slice(0, limit);

    console.log(
      `products ${products.length}  already-current ${products.length - stale.length}  to-embed ${stale.length}`,
    );

    if (dryRun) {
      console.log('--dry-run: nothing embedded or written');
      return;
    }

    let done = 0;
    let failed = 0;

    await runPool(stale, CONCURRENCY, async (product) => {
      try {
        const embedding = await embedImage(product.image_url);
        await client.query(
          `INSERT INTO product_embeddings (product_id, image_hash, embedding, updated_at)
           VALUES ($1, $2, $3::vector, NOW())
           ON CONFLICT (product_id)
           DO UPDATE SET image_hash = EXCLUDED.image_hash,
                          embedding = EXCLUDED.embedding,
                          updated_at = NOW()`,
          [
            product.id,
            imageHash(product.image_url),
            toVectorLiteral(embedding),
          ],
        );
        done++;
        if (done % 25 === 0) console.log(`embedded ${done}/${stale.length}`);
      } catch (err) {
        failed++;
        console.error(
          `FAILED product ${product.id}: ${(err as Error).message}`,
        );
      }
    });

    console.log(`\nDone. embedded ${done}  failed ${failed}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
