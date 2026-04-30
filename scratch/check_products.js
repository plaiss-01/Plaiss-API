const { Pool } = require('pg');

async function main() {
  const url = "postgresql://eraadmin:EraOfMktg2026Secure@eraofmarketing-db.cluster-cfu6wo4i8gx2.eu-north-1.rds.amazonaws.com:5432/eraofmarketing?schema=public";
  const pool = new Pool({ connectionString: url });
  
  try {
    const res = await pool.query('SELECT COUNT(*) FROM "Product"');
    console.log(`Total products: ${res.rows[0].count}`);
    
    const merchants = await pool.query('SELECT DISTINCT merchant FROM "Product"');
    console.log(`Unique merchants:`, merchants.rows.map(r => r.merchant));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
