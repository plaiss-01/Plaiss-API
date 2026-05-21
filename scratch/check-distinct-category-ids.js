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
    const res = await client.query(`
      SELECT 
        category_id, 
        COUNT(*) as count,
        ARRAY_AGG(DISTINCT category_name) FILTER (WHERE category_name IS NOT NULL) as sample_cats,
        (SELECT merchant_category FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p2 WHERE p2.category_id = p.category_id AND p2.merchant_category IS NOT NULL LIMIT 1) as sample_merchant_cat
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p
      GROUP BY category_id
      ORDER BY count DESC
    `);
    console.log("Category ID mappings in Product table:");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
  }
  await pool.end();
}

main();
