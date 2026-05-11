import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const client = await pool.connect();
  try {
    console.log('Checking column nullability on ProductColorVariant...');
    const res = await client.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ProductColorVariant';
    `);
    console.table(res.rows);

  } catch (e) {
    console.error('Error during check:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
check();
