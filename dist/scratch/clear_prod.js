"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('Clearing PROD table...');
    try {
        const result = await prisma.$executeRawUnsafe('TRUNCATE TABLE "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"');
        console.log('Successfully cleared PROD table.');
    }
    catch (err) {
        console.error('Error clearing table:', err.message);
    }
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=clear_prod.js.map