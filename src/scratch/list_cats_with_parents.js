
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function listAll() {
  await client.connect();
  const res = await client.query('SELECT id, name, slug, "parentId" FROM "Category" ORDER BY name');
  console.log(`Total categories: ${res.rows.length}`);
  res.rows.forEach(r => console.log(`  - ${r.name} (${r.slug}) [${r.id}] Parent: ${r.parentId}`));
  await client.end();
}
listAll().catch(console.error);
