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
  console.log('Starting deduplication on existing PROD data...');
  
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
  let variantCount = 0;

  console.log(`Grouped into ${groups.size} unique products. Processing duplicates...`);

  for (const [key, products] of groups.entries()) {
    if (products.length <= 1) continue;

    // Pick the best "Master" product
    const sorted = products.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
    const master = sorted[0];
    const variants = sorted.slice(1);

    for (const v of variants) {
      try {
        // Check if it already has color info
        const colorName = v.colour || v.name.split(' ').find((word) => 
          ['red', 'blue', 'green', 'black', 'white', 'grey', 'gray', 'yellow', 'pink', 'purple', 'brown', 'beige', 'cream', 'teal', 'navy', 'charcoal', 'silver', 'gold'].includes(word.toLowerCase())
        ) || 'Original';

        // 1. Insert into ProductColorVariant
        await pool.query(`
          INSERT INTO "ProductColorVariant" (id, product_id, color_name, image_url, product_url, awin_id)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [
          master.id,
          colorName,
          v.imageUrl || '',
          v.productUrl || '',
          v.id
        ]);

        // 2. Delete the duplicate product
        await pool.query(`
          DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
          WHERE aw_product_id = $1
        `, [v.id]);

        mergedCount++;
        variantCount++;
        
        if (mergedCount % 100 === 0) {
          console.log(`Merged ${mergedCount} products...`);
        }
      } catch (err) {
        console.error(`Failed to merge ${v.name} into ${master.name}: ${err.message}`);
      }
    }
  }

  console.log(`Deduplication complete. Merged ${mergedCount} products into variants.`);
  await pool.end();
}

main().catch(console.error);
