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
    console.log('Fetching unique categories from PROD table...');
    const categories = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT category_name 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name IS NOT NULL AND category_name != ''
    LIMIT 50
  `);
    console.log('Unique Categories found:');
    console.log(categories.map(c => c.category_name));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check_categories.js.map