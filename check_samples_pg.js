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
  const condition = `
    ("colour" IS NULL OR "colour" = '' OR "colour" = 'Original') 
    AND ("sizeStockStatus" IS NULL OR "sizeStockStatus" = '')
  `;

  // 1. Get category breakdown
  const catRes = await pool.query(`
    SELECT category, COUNT(*) as count 
    FROM "Product" 
    WHERE ${condition}
    GROUP BY category
    ORDER BY count DESC
    LIMIT 10;
  `);

  // 2. Get sample product names
  const sampleRes = await pool.query(`
    SELECT name, category, merchant
    FROM "Product" 
    WHERE ${condition}
    LIMIT 10;
  `);

  console.log('--- Top Categories for Missing Color & Size ---');
  console.table(catRes.rows);
  console.log('\n--- 10 Sample Products ---');
  console.table(sampleRes.rows);
  
  await pool.end();
}

main().catch(console.error);
