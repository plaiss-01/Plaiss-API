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
      GROUP BY category_name
      ORDER BY count DESC;
    `);
    console.log(`Total unique categories in PROD: ${res.rowCount}`);
    console.table(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
}

main().catch(console.error);
