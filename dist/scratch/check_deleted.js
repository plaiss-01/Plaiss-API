"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
async function main() {
    const prisma = new client_1.PrismaClient();
    console.log('Checking for deleted categories...');
    const deletedCategories = await prisma.category.findMany({
        where: { isDeleted: true }
    });
    console.log(`Found ${deletedCategories.length} deleted categories:`, deletedCategories.map(c => c.name));
    await prisma.$disconnect();
}
main();
//# sourceMappingURL=check_deleted.js.map