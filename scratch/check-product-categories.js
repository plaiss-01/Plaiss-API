const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
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
  const client = await pool.connect();
  try {
    console.log("Samples of products with different categoryIds:");
    const res = await client.query(`
      SELECT aw_product_id, product_name, category_name, category_id, merchant_category, merchant_name
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE category_id IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 15
    `);
    console.table(res.rows);

    console.log("\nCounts of products by category_name (top 30):");
    const countRes = await client.query(`
      SELECT category_name, COUNT(*) as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      GROUP BY category_name
      ORDER BY count DESC
      LIMIT 30
    `);
    console.table(countRes.rows);

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
  }
  await pool.end();
}

main();
