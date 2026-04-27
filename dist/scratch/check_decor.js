"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const categories = await prisma.category.findMany({
        where: {
            OR: [
                { name: { contains: 'Decor', mode: 'insensitive' } },
                { name: { contains: 'Accessory', mode: 'insensitive' } },
                { name: { contains: 'Art', mode: 'insensitive' } }
            ]
        }
    });
    console.log(JSON.stringify(categories, null, 2));
}
main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
//# sourceMappingURL=check_decor.js.map