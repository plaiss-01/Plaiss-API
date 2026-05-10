const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  const match = envFile.match(/^DATABASE_URL=["']?(.+?)["']?$/m);
  if (match) {
    databaseUrl = match[1];
  }
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  // Check products for merchant SCS
  const res = await pool.query(`
    SELECT name, "imageUrl", merchant
    FROM "Product" 
    WHERE merchant ILIKE '%scs%'
    LIMIT 10;
  `);

  console.log('--- Merchant ScS Products Image Check ---');
  console.table(res.rows);
  
  // Check total products without images
  const countRes = await pool.query(`
    SELECT COUNT(*) as count 
    FROM "Product" 
    WHERE "imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" LIKE '%no_image%' OR "imageUrl" LIKE '%noimage%';
  `);
  
  console.log('\nTotal products missing valid images:', countRes.rows[0].count);
  
  await pool.end();
}

main().catch(console.error);
