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
    console.log('Checking PROD table data...');
    const products = await prisma.product.findMany({
        take: 5,
        select: {
            id: true,
            name: true,
            category: true,
            merchant: true
        }
    });
    console.log('Sample Products:', JSON.stringify(products, null, 2));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check_prod_data.js.map