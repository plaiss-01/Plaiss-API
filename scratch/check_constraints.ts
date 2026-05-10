import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const client = await pool.connect();
  try {
    console.log('Checking constraints on ProductColorVariant...');
    const res = await client.query(`
      SELECT
          conname AS constraint_name,
          conrelid::regclass AS table_name,
          a.attname AS column_name,
          confrelid::regclass AS referenced_table,
          af.attname AS referenced_column
      FROM
          pg_constraint c
      JOIN
          pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      JOIN
          pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
      WHERE
          conrelid = '"ProductColorVariant"'::regclass;
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
