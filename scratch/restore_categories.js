const { Pool } = require('pg');

async function main() {
  const url = "postgresql://eraadmin:EraOfMktg2026Secure@eraofmarketing-db.cluster-cfu6wo4i8gx2.eu-north-1.rds.amazonaws.com:5432/eraofmarketing?schema=public";
  const pool = new Pool({ connectionString: url });
  
  try {
    const res = await pool.query('UPDATE "Category" SET "isDeleted" = false WHERE "isDeleted" = true RETURNING name');
    console.log(`Restored ${res.rows.length} categories:`, res.rows.map(r => r.name));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
