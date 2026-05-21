const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
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
  console.log('Querying database for lighting-related products in AWIN_AFFILIAT_PRODUCTS_DATA_PROD...');

  try {
    // 1. Check categories
    console.log('\n--- Categories in Category table:');
    const catRes = await pool.query(`
      SELECT id, name, slug, "parentId" 
      FROM "Category" 
      ORDER BY name;
    `);
    console.table(catRes.rows);

    // 2. Check product counts by category_name in PROD table
    console.log('\n--- Product counts by category_name in PROD table:');
    const prodCatRes = await pool.query(`
      SELECT category_name, count(*)::int as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      GROUP BY category_name
      ORDER BY count DESC;
    `);
    console.table(prodCatRes.rows);

    // 3. Count products with "light", "lamp", "led" in product_type
    console.log('\n--- Products by product_type containing light/lamp/led:');
    const typeRes = await pool.query(`
      SELECT product_type, count(*)::int as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE product_type ILIKE '%light%' OR product_type ILIKE '%lamp%' OR product_type ILIKE '%led%'
      GROUP BY product_type
      ORDER BY count DESC
      LIMIT 10;
    `);
    console.table(typeRes.rows);

    // 4. Total count of products in PROD table matching lighting keywords
    const countRes = await pool.query(`
      SELECT count(*)::int as total
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE category_name ILIKE '%light%' 
         OR category_name ILIKE '%lamp%'
         OR merchant_category ILIKE '%light%'
         OR merchant_category ILIKE '%lamp%'
         OR product_type ILIKE '%light%'
         OR product_type ILIKE '%lamp%';
    `);
    console.log(`\nTotal products matching lighting keywords: ${countRes.rows[0].total}`);

    // 5. Total count of all products in PROD table
    const totalRes = await pool.query(`
      SELECT count(*)::int as total
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD";
    `);
    console.log(`Total products in PROD table: ${totalRes.rows[0].total}`);

  } catch (e) {
    console.error('Error during query:', e.message);
  }

  await pool.end();
}

main().catch(console.error);
