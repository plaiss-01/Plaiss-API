/**
 * One-off backfill for `material_clean` on the PROD product table.
 *
 * New rows get the value at import time (awin.service transform stage); this
 * fills in the rows that were already there. Safe to re-run - it recomputes
 * every row from the same rules, so correcting a rule and running again is
 * the intended workflow.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/backfill-material.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/backfill-material.ts
 *
 * Connection comes from DATABASE_URL.
 */
import { Client } from 'pg';
import { deriveMaterial } from '../src/awin/material.util';

const TABLE = 'AWIN_AFFILIAT_PRODUCTS_DATA_PROD';
const BATCH = 1000;
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (!dryRun) {
      // Idempotent: the column also lives in schema.prisma, but this lets the
      // script run against a database that has not booted the new app yet.
      await client.query(
        `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS material_clean text`,
      );
    }

    const { rows } = await client.query(
      `SELECT aw_product_id AS id, product_name, merchant_category, description
         FROM "${TABLE}"`,
    );

    const counts = new Map<string, number>();
    const updates: Array<[string, string]> = [];
    let unmatched = 0;

    for (const r of rows) {
      const material = deriveMaterial(
        r.product_name,
        r.merchant_category,
        r.description,
      );
      if (material) {
        counts.set(material, (counts.get(material) || 0) + 1);
        updates.push([r.id, material]);
      } else {
        unmatched++;
      }
    }

    const pct = ((100 * updates.length) / rows.length).toFixed(1);
    console.log(
      `rows ${rows.length}  matched ${updates.length} (${pct}%)  unmatched ${unmatched}`,
    );
    console.log(`\n${counts.size} distinct materials:`);
    for (const [material, n] of [...counts].sort((a, b) => b[1] - a[1])) {
      console.log(`${String(n).padStart(7)}  ${material}`);
    }

    if (dryRun) {
      console.log('\n--dry-run: nothing written');
      return;
    }

    // Null the column first so a row that no longer matches any rule is
    // cleared rather than keeping a stale value from a previous run.
    await client.query(`UPDATE "${TABLE}" SET material_clean = NULL`);

    for (let i = 0; i < updates.length; i += BATCH) {
      const slice = updates.slice(i, i + BATCH);
      const values = slice
        .map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`)
        .join(',');
      await client.query(
        `UPDATE "${TABLE}" AS p SET material_clean = v.material
           FROM (VALUES ${values}) AS v(id, material)
          WHERE p.aw_product_id = v.id`,
        slice.flat(),
      );
      console.log(
        `  updated ${Math.min(i + BATCH, updates.length)}/${updates.length}`,
      );
    }

    await client.query(
      `CREATE INDEX IF NOT EXISTS "AWIN_AFFILIAT_PRODUCTS_DATA_PROD_material_clean_idx"
         ON "${TABLE}" (material_clean)`,
    );
    console.log('\ndone');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
