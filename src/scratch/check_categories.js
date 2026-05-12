require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
  await client.connect();
  const categories = ['Plants', 'Light', 'Decor', 'Sofa', 'Tables', 'Beds'];
  console.log('Checking categories in DB:');
  
  for (const cat of categories) {
    const catRes = await client.query(`SELECT * FROM "Category" WHERE LOWER(name) = LOWER($1)`, [cat]);
    const prodRes = await client.query(`SELECT DISTINCT category_name FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" WHERE LOWER(category_name) LIKE LOWER($1)`, [`%${cat}%`]);
    
    console.log(`${cat}:`);
    console.log(`  In Category table: ${catRes.rows.length > 0 ? 'Available' : 'Not Available'}`);
    console.log(`  In Product table: ${prodRes.rows.length > 0 ? 'Available as distinct' : 'Not Available'}`);
  }
  
  await client.end();
}
check().catch(console.error);
