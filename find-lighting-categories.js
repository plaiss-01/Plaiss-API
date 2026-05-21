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
  try {
    // Fetch all categories
    const res = await pool.query('SELECT id, name, "parentId" FROM "Category"');
    const categories = res.rows;
    
    // Find the 'Lighting' root category
    const lightingRoot = categories.find(c => c.name.toLowerCase() === 'lighting');
    if (!lightingRoot) {
      console.log('No Category named "Lighting" found.');
      await pool.end();
      return;
    }
    
    console.log(`Found root Lighting category ID: ${lightingRoot.id}`);
    
    // Find all children recursively
    const lightingCategoryIds = new Set([lightingRoot.id]);
    const lightingCategoryNames = new Set([lightingRoot.name]);
    
    let added = true;
    while (added) {
      added = false;
      for (const cat of categories) {
        if (cat.parentId && lightingCategoryIds.has(cat.parentId) && !lightingCategoryIds.has(cat.id)) {
          lightingCategoryIds.add(cat.id);
          lightingCategoryNames.add(cat.name);
          added = true;
        }
      }
    }
    
    console.log('\nAll categories under Lighting branch:');
    console.log(Array.from(lightingCategoryNames));
    
    // Get product counts for these categories
    const namesArray = Array.from(lightingCategoryNames);
    const placeholders = namesArray.map((_, i) => `$${i + 1}`).join(', ');
    
    const countRes = await pool.query(
      `SELECT count(*)::int as total FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" WHERE category_name IN (${placeholders})`,
      namesArray
    );
    console.log(`\nTotal products in PROD with these category names: ${countRes.rows[0].total}`);
    
    const countDevRes = await pool.query(
      `SELECT count(*)::int as total FROM "AWIN_AFFILIAT_PRODUCTS_DATA_DEV" WHERE category_name IN (${placeholders})`,
      namesArray
    );
    console.log(`Total products in DEV with these category names: ${countDevRes.rows[0].total}`);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
}

main().catch(console.error);
