const { Pool } = require('pg');
require('dotenv').config();

async function checkDb() {
  const url = process.env.DATABASE_URL;
  console.log(`Checking connection to: ${url.split('@')[1]}`); // Log host only for safety

  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL.');
    
    const res = await client.query('SELECT COUNT(*) FROM "Product"');
    console.log(`✅ Table "Product" found. Total count: ${res.rows[0].count}`);
    
    const today = new Date().toISOString().split('T')[0];
    const todayRes = await client.query(`SELECT COUNT(*) FROM "Product" WHERE "createdAt" >= '${today}'`);
    console.log(`🆕 Products added today (${today}): ${todayRes.rows[0].count}`);
    
    console.log('Fetching last 5 products...');
    const products = await client.query('SELECT * FROM "Product" ORDER BY "createdAt" DESC LIMIT 5');
    console.dir(products.rows, { depth: null });
    
    client.release();
  } catch (err) {
    console.error('❌ Database Error:', err.message);
    if (err.message.includes('does not exist')) {
      console.log('💡 Suggestion: You might need to run "npx prisma db push" to create tables in the new database.');
    }
  } finally {
    await pool.end();
  }
}

checkDb();
