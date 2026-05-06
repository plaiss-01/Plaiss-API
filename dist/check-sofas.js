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
    const sofaCats = await prisma.category.findMany({
        where: {
            OR: [
                { name: { contains: 'sofa', mode: 'insensitive' } },
                { slug: { contains: 'sofa', mode: 'insensitive' } }
            ]
        }
    });
    console.log('Sofa Related Categories:');
    for (const cat of sofaCats) {
        const children = await prisma.category.findMany({ where: { parentId: cat.id } });
        console.log(`- ${cat.name} (ID: ${cat.id}, Parent: ${cat.parentId}) has ${children.length} children.`);
        for (const child of children) {
            console.log(`  └─ ${child.name} (ID: ${child.id})`);
        }
    }
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-sofas.js.map