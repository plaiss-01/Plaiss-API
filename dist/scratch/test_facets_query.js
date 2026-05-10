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
    console.log('Testing optimized facets query for "sofas" and "Sofas"...');
    const inList = "'sofas', 'Sofas'";
    console.log('Running sizes query...');
    const sizes = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT size_stock_status_clean 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name IN (${inList})
    AND size_stock_status_clean IS NOT NULL AND size_stock_status_clean != ''
  `);
    console.log('Sizes done:', sizes);
    console.log('Running colors query...');
    const colors = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT colour_clean 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name IN (${inList})
    AND colour_clean IS NOT NULL AND colour_clean != ''
  `);
    console.log('Colors done:', colors);
}
main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=test_facets_query.js.map