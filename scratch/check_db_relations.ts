import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const client = await pool.connect();
  try {
    console.log('Checking database tables...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tableNames = tables.rows.map(r => r.table_name);
    console.log('Tables found:', tableNames);

    const hasProd = tableNames.includes('AWIN_AFFILIAT_PRODUCTS_DATA_PROD');
    const hasColor = tableNames.includes('ProductColorVariant');
    const hasAttr = tableNames.includes('ProductAttribute');

    console.log('AWIN_AFFILIAT_PRODUCTS_DATA_PROD exists:', hasProd);
    console.log('ProductColorVariant exists:', hasColor);
    console.log('ProductAttribute exists:', hasAttr);

    if (hasProd && hasColor) {
      console.log('Checking for orphans in ProductColorVariant...');
      // We use quotes because Prisma maps them with exact case
      const orphansColor = await client.query(`
        SELECT COUNT(*) FROM "ProductColorVariant" pcv
        LEFT JOIN "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p ON pcv."productId" = p.aw_product_id
        WHERE p.aw_product_id IS NULL AND pcv."productId" IS NOT NULL
      `);
      console.log('Orphan Color Variants (no matching product):', orphansColor.rows[0].count);
      
      const totalColor = await client.query(`SELECT COUNT(*) FROM "ProductColorVariant"`);
      console.log('Total Color Variants:', totalColor.rows[0].count);
    }

    if (hasProd && hasAttr) {
      console.log('Checking for orphans in ProductAttribute...');
      const orphansAttr = await client.query(`
        SELECT COUNT(*) FROM "ProductAttribute" pa
        LEFT JOIN "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p ON pa."productId" = p.aw_product_id
        WHERE p.aw_product_id IS NULL AND pa."productId" IS NOT NULL
      `);
      console.log('Orphan Attributes (no matching product):', orphansAttr.rows[0].count);
      
      const totalAttr = await client.query(`SELECT COUNT(*) FROM "ProductAttribute"`);
      console.log('Total Attributes:', totalAttr.rows[0].count);
    }

  } catch (e) {
    console.error('Error during check:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
check();
