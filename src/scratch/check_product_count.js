require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();
  const res = await client.query('SELECT COUNT(*)::int AS count FROM "Product"');
  console.log('Total Products in Product table:', res.rows[0].count);
  await client.end();
}
check().catch(console.error);
