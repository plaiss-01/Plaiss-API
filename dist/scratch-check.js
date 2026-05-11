"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const products = await prisma.product.findMany({
        where: {
            name: { contains: 'Owenton', mode: 'insensitive' }
        },
        select: {
            id: true,
            name: true,
            slug: true,
            category: true
        }
    });
    console.log(JSON.stringify(products, null, 2));
}
main()
    .catch(e => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=scratch-check.js.map