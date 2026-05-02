"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
async function main() {
    const prisma = new client_1.PrismaClient();
    const search = 'Chairs';
    const categories = await prisma.category.findMany({
        where: {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } }
            ]
        },
        include: { parent: true, children: true }
    });
    console.log(`Found ${categories.length} categories matching "${search}":`);
    categories.forEach(c => {
        console.log(`ID: ${c.id} | Name: ${c.name} | Slug: ${c.slug} | ParentId: ${c.parentId} | Children: ${c.children.length}`);
    });
    const topLevelChairs = categories.find(c => !c.parentId);
    if (topLevelChairs) {
        console.log(`\nTop level category: ${topLevelChairs.name}`);
        console.log(`Children: ${topLevelChairs.children.map((child) => child.name).join(', ')}`);
    }
    else {
        console.log('\nNo top-level category found for "Chairs"');
    }
    await prisma.$disconnect();
}
main();
//# sourceMappingURL=inspect_categories.js.map