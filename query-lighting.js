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
  console.log('Querying database for lighting-related products and categories...');

  try {
    // 1. Check categories
    console.log('\n--- Categories containing "light", "lamp" or similar:');
    const catRes = await pool.query(`
      SELECT id, name, slug, "parentId" 
      FROM "Category" 
      WHERE name ILIKE '%light%' OR name ILIKE '%lamp%' OR name ILIKE '%lum%';
    `);
    console.table(catRes.rows);

    // 2. Check product counts by category
    console.log('\n--- Product counts by category:');
    const prodCatRes = await pool.query(`
      SELECT p.category, count(*)::int as count
      FROM "Product" p
      GROUP BY p.category
      ORDER BY count DESC;
    `);
    console.table(prodCatRes.rows);

    // 3. Count products with "light", "lamp", "led" in productType
    console.log('\n--- Products by productType:');
    const typeRes = await pool.query(`
      SELECT "productType", count(*)::int as count
      FROM "Product"
      WHERE "productType" ILIKE '%light%' OR "productType" ILIKE '%lamp%' OR "productType" ILIKE '%led%'
      GROUP BY "productType"
      ORDER BY count DESC;
    `);
    console.table(typeRes.rows);

    // 4. Count products with "lighting" or "lamp" related categories
    const countRes = await pool.query(`
      SELECT count(*)::int as total
      FROM "Product"
      WHERE category ILIKE '%light%' 
         OR category ILIKE '%lamp%'
         OR "merchantCategory" ILIKE '%light%'
         OR "merchantCategory" ILIKE '%lamp%'
         OR "productType" ILIKE '%light%'
         OR "productType" ILIKE '%lamp%';
    `);
    console.log(`\nTotal products matching lighting keywords (category, merchantCategory, productType): ${countRes.rows[0].total}`);

  } catch (e) {
    console.error('Error during query:', e.message);
  }

  await pool.end();
}

main().catch(console.error);
