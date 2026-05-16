
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();
  
  const cats = ['Table', 'tables'];
  for (const c of cats) {
    const res = await client.query('SELECT product_name, category_name FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" WHERE category_name = $1 LIMIT 5', [c]);
    console.log(`--- Products with category_name = "${c}" ---`);
    res.rows.forEach(r => console.log(`  - ${r.product_name} (${r.category_name})`));
  }
  
  await client.end();
}
check().catch(console.error);
