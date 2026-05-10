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
  console.log('Checking columns of AWIN_AFFILIAT_PRODUCTS_DATA_PROD...');
  
  const colRes = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'awin_affiliat_products_data_prod' 
       OR table_name = 'AWIN_AFFILIAT_PRODUCTS_DATA_PROD';
  `);
  
  const columns = colRes.rows.map(r => r.column_name);
  console.log('Columns found:', columns);

  if (columns.length === 0) {
    console.log('Table AWIN_AFFILIAT_PRODUCTS_DATA_PROD not found.');
    await pool.end();
    return;
  }

  // Check for common column names for color and size
  const colorCol = columns.includes('colour') ? 'colour' : (columns.includes('color') ? 'color' : null);
  const sizeCol = columns.includes('size_stock_status') ? 'size_stock_status' : (columns.includes('size') ? 'size' : null);

  let query = `SELECT COUNT(*) as total FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"`;
  let conditions = [];

  if (colorCol) {
    conditions.push(`COUNT(*) FILTER (WHERE "${colorCol}" IS NULL OR "${colorCol}" = '' OR "${colorCol}" = 'Original') as no_color`);
  }
  if (sizeCol) {
    conditions.push(`COUNT(*) FILTER (WHERE "${sizeCol}" IS NULL OR "${sizeCol}" = '') as no_size`);
  }

  if (conditions.length > 0) {
    query = `
      SELECT 
        COUNT(*) as total,
        ${conditions.join(',\n        ')}
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    `;
  }

  console.log('\nRunning validity check...');
  try {
    const res = await pool.query(query);
    console.table(res.rows);
  } catch (e) {
    // Try lowercase table name just in case
    try {
      const res = await pool.query(query.replace(/"AWIN_AFFILIAT_PRODUCTS_DATA_PROD"/g, '"awin_affiliat_products_data_prod"'));
      console.table(res.rows);
    } catch (err) {
      console.error('Error querying table:', e.message);
    }
  }

  await pool.end();
}

main().catch(console.error);
