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
    const name = process.argv[2] || 'Aveley';
    console.log(`Searching for "${name}"...`);
    const products = await prisma.product.findMany({
        where: { name: { contains: name, mode: 'insensitive' } },
        select: { id: true, name: true, merchant: true }
    });
    console.log(JSON.stringify(products, null, 2));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=search-name.js.map