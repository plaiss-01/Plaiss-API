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
    const ids = ['925b4398-3020-4f85-80e2-23afe0b12c84', 'ddf654ba-8aac-438e-9dad-816e5b4ccf13'];
    for (const id of ids) {
        const cat = await prisma.category.findUnique({ where: { id } });
        console.log(`ID ${id}: ${cat?.name} (Slug: ${cat?.slug})`);
    }
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-ids.js.map