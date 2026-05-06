"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('Targeted Deduplication for "Flex Corduroy"...');
    const products = await prisma.product.findMany({
        where: { name: { contains: 'Flex Corduroy', mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' }
    });
    if (products.length <= 1) {
        console.log('Not enough products found for deduplication.');
        return;
    }
    const primary = products[0];
    const variants = products.slice(1);
    console.log(`Primary Product: ${primary.name} (ID: ${primary.id})`);
    for (const variant of variants) {
        const colorMatch = variant.name.match(/In\s+([a-zA-Z]+)/i);
        const colorName = colorMatch ? colorMatch[1] : 'Unknown';
        console.log(`- Adding variant: ${variant.name} as color "${colorName}"`);
        await prisma.productColorVariant.create({
            data: {
                productId: primary.id,
                colorName: colorName,
                imageUrl: variant.imageUrl,
                productUrl: variant.productUrl,
                awinId: variant.awinId,
            }
        });
        await prisma.product.delete({ where: { id: variant.id } });
    }
    console.log('Targeted deduplication complete!');
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=fix-flex.js.map