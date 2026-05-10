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
    const leatherSofaCat = await prisma.category.findFirst({
        where: { name: { contains: 'Leather Sofas', mode: 'insensitive' } }
    });
    if (!leatherSofaCat) {
        console.log('Leather Sofas category not found');
        return;
    }
    const products = await prisma.product.findMany({
        where: { category: { contains: leatherSofaCat.name, mode: 'insensitive' } },
        take: 5,
        select: { name: true, category: true }
    });
    console.log(`Products in Leather Sofas (ID: ${leatherSofaCat.id}):`);
    products.forEach(p => console.log(`- ${p.name} (String Cat: ${p.category})`));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-leather-products.js.map