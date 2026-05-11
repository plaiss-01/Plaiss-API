const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  const match = envFile.match(/^DATABASE_URL=["']?(.+?)["']?$/m);
  if (match) {
    databaseUrl = match[1];
  }
}

const pool = new Pool({ connectionString: databaseUrl });

async function flushBatches(pool, inserts, deletes) {
  if (inserts.length === 0) return;

  // 1. Batched Insert
  const insertQuery = `
    INSERT INTO "ProductColorVariant" (id, product_id, color_name, image_url, product_url, awin_id)
    VALUES ${inserts.map((_, i) => `(gen_random_uuid(), $${i*5 + 1}, $${i*5 + 2}, $${i*5 + 3}, $${i*5 + 4}, $${i*5 + 5})`).join(', ')}
    ON CONFLICT DO NOTHING
  `;
  const flatInserts = inserts.flat();
  
  // 2. Batched Delete
  const deleteQuery = `
    DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE aw_product_id IN (${deletes.map((_, i) => `$${i + 1}`).join(', ')})
  `;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(insertQuery, flatInserts);
    await client.query(deleteQuery, deletes);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Batch failed, rolling back:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Starting BATCHED deduplication on existing PROD data...');
  
  const res = await pool.query(`
    SELECT aw_product_id as id, product_name as name, description, colour, image_url as "imageUrl", product_url as "productUrl", raw_row as "rawRow"
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
  `);

  console.log(`Loaded ${res.rows.length} products. Grouping...`);

  const groups = new Map();

  res.rows.forEach((p) => {
    let coreName = p.name
      .toLowerCase()
      .replace(/\b(fabric|leather|velvet|chenille|linen|wood|metal|glass|gloss|matt|oak|pine|walnut|ash|marble)\b/gi, '')
      .replace(/\b(\d+)\s*(seater|piece|set|pack|kg|g|cm|mm|m)\b/gi, '')
      .replace(/^[0-9\s-]+/, '') // Strip leading numbers
      .replace(/\s+/g, ' ')
      .trim();

    if (coreName.length < 5) coreName = p.name.toLowerCase().trim();

    const key = `${coreName}`;
    const group = groups.get(key) || [];
    group.push(p);
    groups.set(key, group);
  });

  let mergedCount = 0;
  let batchInserts = [];
  let batchDeletes = [];
  const BATCH_SIZE = 1000;

  console.log(`Grouped into ${groups.size} unique products. Processing duplicates in batches of ${BATCH_SIZE}...`);

  for (const [key, products] of groups.entries()) {
    if (products.length <= 1) continue;

    const sorted = products.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
    const master = sorted[0];
    const variants = sorted.slice(1);

    for (const v of variants) {
      const colorName = v.colour || v.name.split(' ').find((word) => 
        ['red', 'blue', 'green', 'black', 'white', 'grey', 'gray', 'yellow', 'pink', 'purple', 'brown', 'beige', 'cream', 'teal', 'navy', 'charcoal', 'silver', 'gold'].includes(word.toLowerCase())
      ) || 'Original';

      batchInserts.push([master.id, colorName, v.imageUrl || '', v.productUrl || '', v.id]);
      batchDeletes.push(v.id);

      mergedCount++;

      if (batchInserts.length >= BATCH_SIZE) {
        await flushBatches(pool, batchInserts, batchDeletes);
        console.log(`Merged ${mergedCount} products...`);
        batchInserts = [];
        batchDeletes = [];
      }
    }
  }

  // Flush remaining
  if (batchInserts.length > 0) {
    await flushBatches(pool, batchInserts, batchDeletes);
    console.log(`Merged ${mergedCount} products...`);
  }

  console.log(`Deduplication complete. Merged ${mergedCount} products into variants.`);
  await pool.end();
}

main().catch(console.error);
