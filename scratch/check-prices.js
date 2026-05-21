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
        category_name,
        COUNT(*)::int as total,
        COUNT(discounted_price_clean)::int as count_discounted_price,
        COUNT(original_price_clean)::int as count_original_price,
        MIN(discounted_price_clean) as min_discounted,
        MAX(discounted_price_clean) as max_discounted,
        MIN(search_price) as min_search,
        MAX(search_price) as max_search
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE category_name IN ('Lighting', 'Wall', 'Floor', 'Table', 'Lamp')
      GROUP BY category_name;
    `);
    console.table(res.rows);
  } catch (e) {
    console.error('Error running check query:', e);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(console.error);
