"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const categories = ['Plants', 'Light', 'Decor', 'Sofa', 'Tables', 'Beds'];
    console.log('Checking categories in DB:');
    for (const cat of categories) {
        const found = await prisma.category.findFirst({
            where: { name: { equals: cat, mode: 'insensitive' } },
        });
        console.log(`${cat}: ${found ? 'Available' : 'Not Available'}`);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=check_categories.js.map