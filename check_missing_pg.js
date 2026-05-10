const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env file manually to get DATABASE_URL
const envPath = path.join(__dirname, '.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  const match = envFile.match(/^DATABASE_URL=["']?(.+?)["']?$/m);
  if (match) {
    databaseUrl = match[1];
  }
}

if (!databaseUrl) {
  console.error('DATABASE_URL not found in environment or .env file');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString: databaseUrl,
});

async function main() {
  const res = await pool.query(`
    SELECT 
      COUNT(*) as total_products,
      COUNT(*) FILTER (WHERE "imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" = 'Original') as no_image,
      COUNT(*) FILTER (WHERE ("colour" IS NULL OR "colour" = '' OR "colour" = 'Original') AND ("sizeStockStatus" IS NULL OR "sizeStockStatus" = '')) as no_color_or_size,
      COUNT(*) FILTER (
        WHERE ("imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" = 'Original') 
          AND ("colour" IS NULL OR "colour" = '' OR "colour" = 'Original') 
          AND ("sizeStockStatus" IS NULL OR "sizeStockStatus" = '')
      ) as missing_all
    FROM "Product";
  `);
  console.log('--- Results ---');
  console.log(res.rows[0]);
  console.log('---------------');
  await pool.end();
}

main().catch(console.error);
