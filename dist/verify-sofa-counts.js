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
    const sofaRoot = await prisma.category.findFirst({ where: { name: { equals: 'sofas', mode: 'insensitive' } } });
    if (!sofaRoot)
        return console.log('Sofa Root Not Found');
    const allCats = await prisma.category.findMany();
    const childrenMap = new Map();
    allCats.forEach(c => {
        if (c.parentId) {
            const children = childrenMap.get(c.parentId) || [];
            children.push(c);
            childrenMap.set(c.parentId, children);
        }
    });
    function getDescendantNames(id) {
        const cat = allCats.find(c => c.id === id);
        let names = cat ? [cat.name] : [];
        const children = childrenMap.get(id) || [];
        for (const child of children) {
            names = names.concat(getDescendantNames(child.id));
        }
        return names;
    }
    const descendantNames = getDescendantNames(sofaRoot.id);
    console.log(`Sofas Descendant Names Count: ${descendantNames.length}`);
    const totalProducts = await prisma.product.count({
        where: { category: { in: descendantNames } }
    });
    const rootOnlyProducts = await prisma.product.count({
        where: { category: sofaRoot.name }
    });
    console.log(`Total Combined Products: ${totalProducts}`);
    console.log(`Root Only Products: ${rootOnlyProducts}`);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=verify-sofa-counts.js.map