"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
require("dotenv/config");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('Fetching actual columns from database...');
    const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'AWIN_AFFILIAT_PRODUCTS_DATA_PROD'
  `);
    console.log('Actual Database Columns:', columns.map(c => c.column_name));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=get_table_columns.js.map