"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
async function main() {
    const prisma = new client_1.PrismaClient();
    try {
        const categories = await prisma.category.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        console.log('Last 20 categories:');
        console.log(JSON.stringify(categories, null, 2));
        const count = await prisma.category.count();
        console.log('Total categories:', count);
        const manualCount = await prisma.category.count({ where: { isAwin: false } });
        console.log('Manual categories (isAwin: false):', manualCount);
        const awinCount = await prisma.category.count({ where: { isAwin: true } });
        console.log('Awin categories (isAwin: true):', awinCount);
    }
    catch (error) {
        console.error(error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=check_categories.js.map