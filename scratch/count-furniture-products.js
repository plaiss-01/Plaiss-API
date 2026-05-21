const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
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
  const client = await pool.connect();
  try {
    console.log("Checking categories table in DB...");
    const catRes = await client.query('SELECT id, name, slug, "parentId" FROM "Category"');
    console.log("Total Category records:", catRes.rowCount);
    
    console.log("\nCategories matching 'Furniture' or 'Lighting':");
    for (const cat of catRes.rows) {
      const nameLower = (cat.name || '').toLowerCase();
      const slugLower = (cat.slug || '').toLowerCase();
      if (nameLower.includes('furnit') || slugLower.includes('furnit') || nameLower.includes('lighting') || slugLower.includes('lighting')) {
        console.log(`- Category: id="${cat.id}", name="${cat.name}", slug="${cat.slug}", parentId="${cat.parentId}"`);
      }
    }

    console.log("\nChecking category distribution in Products (top 15)...");
    const prodCatRes = await client.query(`
      SELECT category_name, COUNT(*) as count 
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      GROUP BY category_name 
      ORDER BY count DESC 
      LIMIT 15
    `);
    console.table(prodCatRes.rows);

    console.log("\nChecking category_id in Products (top 15)...");
    const prodCatIdRes = await client.query(`
      SELECT category_id, COUNT(*) as count 
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      GROUP BY category_id 
      ORDER BY count DESC 
      LIMIT 15
    `);
    console.table(prodCatIdRes.rows);

    console.log("\nChecking total count of products in AWIN_AFFILIAT_PRODUCTS_DATA_PROD:");
    const countAll = await client.query('SELECT COUNT(*) FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"');
    console.log("Total products:", countAll.rows[0].count);

    console.log("\nChecking counts matching terms:");
    const queryCounts = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE category_name ILIKE '%furniture%') as cat_furniture_count,
        COUNT(*) FILTER (WHERE category_name ILIKE '%sofa%') as cat_sofa_count,
        COUNT(*) FILTER (WHERE category_name ILIKE '%chair%') as cat_chair_count,
        COUNT(*) FILTER (WHERE category_name ILIKE '%table%') as cat_table_count,
        COUNT(*) FILTER (WHERE merchant_category ILIKE '%furniture%') as path_furniture_count,
        COUNT(*) FILTER (WHERE merchant_category ILIKE '%sofa%') as path_sofa_count,
        COUNT(*) FILTER (WHERE merchant_category ILIKE '%chair%') as path_chair_count,
        COUNT(*) FILTER (WHERE merchant_category ILIKE '%table%') as path_table_count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    `);
    console.table(queryCounts.rows);

  } catch (e) {
    console.error('Error running check:', e);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(console.error);
