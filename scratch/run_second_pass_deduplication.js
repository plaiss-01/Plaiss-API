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

async function main() {
  console.log('Starting SECOND PASS deduplication (merging across colors)...');
  
  const res = await pool.query(`
    SELECT aw_product_id as id, product_name as name, description, colour, image_url as "imageUrl", product_url as "productUrl"
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
  `);

  console.log(`Loaded ${res.rows.length} products. Grouping...`);

  const groups = new Map();

  res.rows.forEach((p) => {
    let coreName = p.name
      .toLowerCase()
      .replace(/\b(fabric|leather|velvet|chenille|linen|wood|metal|glass|gloss|matt|oak|pine|walnut|ash|marble)\b/gi, '')
      .replace(/\b(red|blue|green|black|white|grey|gray|yellow|pink|purple|brown|beige|cream|teal|navy|charcoal|silver|gold|orange)\b/gi, '')
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

  console.log(`Grouped into ${groups.size} unique products. Processing cross-color duplicates...`);

  for (const [key, products] of groups.entries()) {
    if (products.length <= 1) continue;

    const sorted = products.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
    const master = sorted[0];
    const variants = sorted.slice(1);

    console.log(`\nMerging group "${key}" -> Master: ${master.name} (${master.id})`);

    for (const v of variants) {
      try {
        const colorName = v.colour || v.name.split(' ').find((word) => 
          ['red', 'blue', 'green', 'black', 'white', 'grey', 'gray', 'yellow', 'pink', 'purple', 'brown', 'beige', 'cream', 'teal', 'navy', 'charcoal', 'silver', 'gold', 'orange'].includes(word.toLowerCase())
        ) || 'Original';

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // 1. Create a variant for the variant product itself
          await client.query(`
            INSERT INTO "ProductColorVariant" (id, product_id, color_name, image_url, product_url, awin_id)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
          `, [master.id, colorName, v.imageUrl || '', v.productUrl || '', v.id]);

          // 2. Move existing variants from the variant product to the master
          await client.query(`
            UPDATE "ProductColorVariant"
            SET product_id = $1
            WHERE product_id = $2
          `, [master.id, v.id]);

          // 3. Delete the variant product from PROD
          await client.query(`
            DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
            WHERE aw_product_id = $1
          `, [v.id]);

          await client.query('COMMIT');
          mergedCount++;
          console.log(`-> Merged ${v.name} (${v.id}) as variant.`);
        } catch (e) {
          await client.query('ROLLBACK');
          console.error(`-> Failed to merge ${v.id}:`, e.message);
        } finally {
          client.release();
        }
      } catch (err) {
        console.error(`Failed to process ${v.name}: ${err.message}`);
      }
    }
  }

  console.log(`\nSecond pass complete. Merged ${mergedCount} products across colors.`);
  await pool.end();
}

main().catch(console.error);
