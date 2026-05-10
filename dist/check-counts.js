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
    const total = await prisma.product.count();
    const linked = await prisma.product.count({ where: { category: { not: null } } });
    console.log(`Total Products: ${total}`);
    console.log(`Linked Products: ${linked}`);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-counts.js.map