require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();
  // Find categories with sofa/sofas in their name
  const res = await client.query(`SELECT DISTINCT category FROM "Product" WHERE LOWER(category) LIKE '%sofa%' LIMIT 20`);
  console.log('Sofa category names in Product table:');
  res.rows.forEach(r => console.log(' -', r.category));
  await client.end();
}
check().catch(console.error);
