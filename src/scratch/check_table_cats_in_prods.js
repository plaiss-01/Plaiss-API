
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT category_name, COUNT(*) 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name ILIKE '%Table%' 
    GROUP BY category_name
  `);
  console.log('Categories in products matching "Table":');
  res.rows.forEach(r => console.log(`  - ${r.category_name}: ${r.count}`));
  await client.end();
}
check().catch(console.error);
