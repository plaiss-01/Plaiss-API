import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Dropping constraint ProductColorVariant_productId_fkey...');
    await client.query(`
      ALTER TABLE "ProductColorVariant" DROP CONSTRAINT "ProductColorVariant_productId_fkey"
    `);
    console.log('Constraint dropped successfully.');
  } catch (e) {
    console.error('Error dropping constraint:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
