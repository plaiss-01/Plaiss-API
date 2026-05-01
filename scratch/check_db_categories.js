const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not found in environment at ' + path.join(__dirname, '../.env'));
    return;
  }
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    console.log('✅ Connected.');
    
    const res = await client.query('SELECT COUNT(*) FROM "Category"');
    console.log(`Total Categories: ${res.rows[0].count}`);
    
    const manualRes = await client.query('SELECT COUNT(*) FROM "Category" WHERE "isAwin" = false');
    console.log(`Manual Categories (isAwin=false): ${manualRes.rows[0].count}`);

    const awinRes = await client.query('SELECT COUNT(*) FROM "Category" WHERE "isAwin" = true');
    console.log(`Awin Categories (isAwin=true): ${awinRes.rows[0].count}`);

    console.log('\nLast 10 Manual Categories:');
    const manualList = await client.query('SELECT name, "isAwin", "parentId" FROM "Category" WHERE "isAwin" = false ORDER BY "createdAt" DESC LIMIT 10');
    console.table(manualList.rows);

    console.log('\nLast 10 Awin Categories:');
    const awinList = await client.query('SELECT name, "isAwin", "parentId" FROM "Category" WHERE "isAwin" = true ORDER BY "createdAt" DESC LIMIT 10');
    console.table(awinList.rows);
    
    client.release();
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkDb();
