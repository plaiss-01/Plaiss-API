const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://plaissadmin:Plaiss2026Secure!@pg-plaiss-uk.postgres.database.azure.com/plaiss?sslmode=require'
});

async function run() {
  try {
    const res = await pool.query(`SELECT product_name, category_name, merchant_category FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" WHERE product_name ILIKE '%Aveley 3 Seater%' LIMIT 1`);
    console.log("Aveley:", res.rows[0]);
    
    const res2 = await pool.query(`SELECT product_name, category_name, merchant_category FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" WHERE product_name ILIKE '%Kaide Grey 3 Seater%' LIMIT 1`);
    console.log("Kaide:", res2.rows[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
