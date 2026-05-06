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
    console.log('Searching for unmerged 3 Seater Sofas...');
    const products = await prisma.product.findMany({
        where: {
            name: { contains: '3 Seater Sofa', mode: 'insensitive' },
            colorVariants: { none: {} }
        },
        take: 50,
        select: { id: true, name: true, merchant: true, brandName: true }
    });
    console.log(`Found ${products.length} potential duplicates:`);
    products.forEach(p => console.log(`- [${p.merchant}] ${p.name} (Brand: ${p.brandName})`));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=debug-sofas.js.map