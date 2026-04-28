"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const productsWithColor = await prisma.product.count({
        where: {
            colour: { not: null, notIn: ['', ' '] }
        }
    });
    const totalProducts = await prisma.product.count();
    console.log(`Total Products: ${totalProducts}`);
    console.log(`Products with color: ${productsWithColor}`);
    if (productsWithColor > 0) {
        const samples = await prisma.product.findMany({
            where: {
                colour: { not: null, notIn: ['', ' '] }
            },
            take: 5,
            select: { name: true, colour: true }
        });
        console.log('Sample colors:', samples);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=check_colors.js.map