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
    console.log('Checking counts for Sofas and 2 Seater...');
    const sofas = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name ILIKE '%Sofa%'
  `);
    const sofasWith2Seater = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name ILIKE '%Sofa%' 
    AND size_stock_status_clean ILIKE '%2 Seater%'
  `);
    console.log('Total Sofa products:', sofas[0].count);
    console.log('Sofa products with 2 Seater size:', sofasWith2Seater[0].count);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check_sofa_sizes.js.map