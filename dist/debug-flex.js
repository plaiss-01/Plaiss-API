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
    const products = await prisma.product.findMany({
        where: {
            name: { contains: 'Flex Corduroy', mode: 'insensitive' }
        },
        include: {
            colorVariants: true
        }
    });
    console.log(`Found ${products.length} products matching "Flex Corduroy":`);
    products.forEach(p => {
        console.log(`- ID: ${p.id}, Name: ${p.name}, Colour: ${p.colour}, Variants: ${p.colorVariants.length}`);
    });
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=debug-flex.js.map