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
  try {
    const res = await pool.query(`
      SELECT category_name, count(*)::int as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE category_name NOT IN ('Lighting', 'Wall', 'Floor', 'Lamp', 'Table')
        AND (
          category_name ILIKE '%light%' 
          OR category_name ILIKE '%lamp%'
          OR merchant_category ILIKE '%light%'
          OR merchant_category ILIKE '%lamp%'
          OR product_type ILIKE '%light%'
          OR product_type ILIKE '%lamp%'
        )
      GROUP BY category_name
      ORDER BY count DESC;
    `);
    console.table(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
}

main().catch(console.error);
