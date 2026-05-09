require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT name, "imageUrl"
    FROM "Product"
    WHERE "imageUrl" ILIKE '%placeholder%' OR "imageUrl" ILIKE '%no-image%'
    LIMIT 5
  `);
  
  if (res.rows.length > 0) {
    console.log(`Found ${res.rows.length} products with placeholder in URL:`);
    res.rows.forEach(r => {
      console.log(`- Name: ${r.name}`);
      console.log(`  imageUrl: ${r.imageUrl}`);
    });
  } else {
    console.log('No products found with placeholder in URL.');
  }
  
  await client.end();
}
check().catch(console.error);
