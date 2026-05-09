require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();

  // Count all products where category contains 'sofa' (case-insensitive)
  const res = await client.query(`
    SELECT category, COUNT(*) as count
    FROM "Product"
    WHERE LOWER(category) LIKE '%sofa%'
    GROUP BY category
    ORDER BY count DESC
  `);

  let total = 0;
  console.log('Sofa category breakdown:');
  res.rows.forEach(r => {
    console.log(` - "${r.category}": ${r.count}`);
    total += parseInt(r.count);
  });
  console.log(`\nTOTAL sofa products: ${total}`);

  await client.end();
}
check().catch(console.error);
