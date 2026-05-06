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
    const rootSofa = await prisma.category.findFirst({
        where: {
            name: { equals: 'sofas', mode: 'insensitive' }
        }
    });
    if (!rootSofa) {
        console.log('Category "Sofas" not found!');
        return;
    }
    console.log(`Root Sofa: ${rootSofa.name} (ID: ${rootSofa.id})`);
    async function printTree(id, depth = 0) {
        const children = await prisma.category.findMany({ where: { parentId: id } });
        for (const child of children) {
            console.log(`${'  '.repeat(depth)}└─ ${child.name} (ID: ${child.id})`);
            await printTree(child.id, depth + 1);
        }
    }
    await printTree(rootSofa.id);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-sofa-tree.js.map