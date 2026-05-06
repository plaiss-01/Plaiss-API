"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
async function debug() {
    const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    const prisma = new client_1.PrismaClient({ adapter });
    const categorySlug = 'furniture';
    const allCats = await prisma.category.findMany();
    const categoryMap = new Map();
    const childrenMap = new Map();
    allCats.forEach(cat => {
        categoryMap.set(cat.id, cat);
        if (cat.parentId) {
            const children = childrenMap.get(cat.parentId) || [];
            children.push(cat);
            childrenMap.set(cat.parentId, children);
        }
    });
    const targetCats = allCats.filter(c => c.slug.toLowerCase() === categorySlug.toLowerCase() ||
        c.name.toLowerCase() === categorySlug.toLowerCase());
    console.log(`Found ${targetCats.length} target categories for "${categorySlug}"`);
    const getDescendantIds = (catId, visited = new Set()) => {
        if (visited.has(catId))
            return [];
        visited.add(catId);
        let ids = [catId];
        const children = childrenMap.get(catId) || [];
        for (const child of children) {
            ids = ids.concat(getDescendantIds(child.id, visited));
        }
        return ids;
    };
    const allCategoryIds = [];
    const allCategoryNames = [];
    for (const cat of targetCats) {
        const children = childrenMap.get(cat.id) || [];
        if (children.length > 0) {
            console.log(`Category "${cat.name}" has children. Using children only.`);
            for (const child of children) {
                const descendantIds = getDescendantIds(child.id);
                allCategoryIds.push(...descendantIds);
                descendantIds.forEach(id => {
                    const c = categoryMap.get(id);
                    if (c) {
                        allCategoryNames.push(c.name);
                        allCategoryNames.push(c.name.toLowerCase().trim());
                    }
                });
            }
        }
        else {
            console.log(`Category "${cat.name}" has NO children. Using self.`);
            allCategoryIds.push(cat.id);
            allCategoryNames.push(cat.name);
        }
    }
    const uniqueIds = Array.from(new Set(allCategoryIds));
    const uniqueNames = Array.from(new Set(allCategoryNames));
    console.log(`Unique IDs count: ${uniqueIds.length}`);
    console.log(`Unique Names count: ${uniqueNames.length}`);
    const where = {
        OR: [
            { internalCategoryId: { in: uniqueIds } },
            { category: { in: uniqueNames, mode: 'insensitive' } },
            { merchantCategory: { in: uniqueNames, mode: 'insensitive' } },
        ]
    };
    const total = await prisma.product.count({ where });
    console.log(`TOTAL PRODUCTS: ${total}`);
    for (const cat of targetCats) {
        const children = childrenMap.get(cat.id) || [];
        for (const child of children) {
            const childIds = getDescendantIds(child.id);
            const childNames = childIds.map(id => categoryMap.get(id).name);
            const childWhere = {
                OR: [
                    { internalCategoryId: { in: childIds } },
                    { category: { in: childNames, mode: 'insensitive' } },
                    { merchantCategory: { in: childNames, mode: 'insensitive' } },
                ]
            };
            const childTotal = await prisma.product.count({ where: childWhere });
            console.log(`- Child "${child.name}": ${childTotal} products`);
        }
    }
    await prisma.$disconnect();
}
debug();
//# sourceMappingURL=debug-counts.js.map