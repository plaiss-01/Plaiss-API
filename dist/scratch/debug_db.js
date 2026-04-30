"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
async function main() {
    const prisma = new client_1.PrismaClient();
    try {
        const result = await prisma.$queryRaw `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Category' AND column_name = 'order';
    `;
        console.log('Column check result:', result);
        const categories = await prisma.category.findMany({
            orderBy: { order: 'asc' }
        });
        console.log('Categories fetched successfully:', categories.length);
    }
    catch (e) {
        console.error('Error:', e);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=debug_db.js.map