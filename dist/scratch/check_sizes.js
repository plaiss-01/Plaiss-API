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
    console.log('Fetching unique sizes from PROD table...');
    const sizes = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT size_stock_status_clean 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE size_stock_status_clean IS NOT NULL AND size_stock_status_clean != ''
    LIMIT 50
  `);
    console.log('Unique Sizes found:');
    console.log(sizes.map(s => s.size_stock_status_clean));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check_sizes.js.map