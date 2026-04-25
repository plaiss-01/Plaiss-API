"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const count = await prisma.product.deleteMany({});
    console.log(`Deleted ${count.count} products.`);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=clear_products.js.map