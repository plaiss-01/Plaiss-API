require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();
  
  const res = await client.query(`
    SELECT "aw_product_id", "product_name", "image_url" 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE LOWER(category_name) LIKE '%tables%'
    LIMIT 5
  `);
  
  console.log(`Found ${res.rows.length} products in category 'Tables':`);
  
  res.rows.forEach(r => {
    console.log(`\nProduct ID: ${r.aw_product_id}`);
    console.log(`Name: ${r.product_name}`);
    console.log(`Image URL: ${r.image_url}`);
  });
  
  await client.end();
}
check().catch(console.error);
