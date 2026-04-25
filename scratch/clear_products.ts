import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const count = await prisma.product.deleteMany({});
    console.log(`Deleted ${count.count} products.`);
}
main().finally(() => prisma.$disconnect());
