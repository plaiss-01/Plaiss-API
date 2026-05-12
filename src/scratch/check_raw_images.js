require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();
  
  // Fetch 5 products where imageUrl might be invalid or empty
  const res = await client.query(`
    SELECT "aw_product_id", "product_name", "image_url", "raw_row" 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE "image_url" IS NULL 
       OR "image_url" = '' 
       OR "image_url" = 'null' 
       OR "image_url" = 'undefined'
       OR "image_url" LIKE '%placeholder%'
    LIMIT 5
  `);
  
  console.log(`Found ${res.rows.length} products with potentially invalid images:`);
  
  res.rows.forEach(r => {
    console.log(`\nProduct ID: ${r.aw_product_id}`);
    console.log(`Name: ${r.product_name}`);
    console.log(`Image URL: ${r.image_url}`);
    console.log(`Raw Row: ${r.raw_row}`);
  });
  
  await client.end();
}
check().catch(console.error);
