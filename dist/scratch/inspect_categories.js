"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { category: { contains: 'Kitchen', mode: 'insensitive' } },
                { merchantCategory: { contains: 'Kitchen', mode: 'insensitive' } },
                { merchantProductCategoryPath: { contains: 'Kitchen', mode: 'insensitive' } },
                { name: { contains: 'Kitchen', mode: 'insensitive' } }
            ]
        },
        select: {
            category: true,
            merchantCategory: true,
            merchantProductCategoryPath: true
        },
        take: 20
    });
    console.log(JSON.stringify(products, null, 2));
}
main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
//# sourceMappingURL=inspect_categories.js.map