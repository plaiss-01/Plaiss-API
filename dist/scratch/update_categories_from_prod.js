"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
require("dotenv/config");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function toSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^\w ]+/g, '')
        .replace(/ +/g, '-');
}
async function main() {
    console.log('Fetching unique categories from PROD table...');
    const uniqueCats = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT category_name 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name IS NOT NULL AND category_name != ''
  `);
    console.log(`Found ${uniqueCats.length} unique categories.`);
    console.log('Clearing existing Category table...');
    await prisma.$queryRawUnsafe(`DELETE FROM "Category"`);
    console.log('Inserting categories derived from products...');
    for (const cat of uniqueCats) {
        const name = cat.category_name.trim();
        const slug = toSlug(name);
        try {
            await prisma.$executeRawUnsafe(`
        INSERT INTO "Category" (id, name, slug, "isAwin", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (slug) DO NOTHING
      `, slug, name, slug, true);
        }
        catch (err) {
            console.error(`Failed to insert ${name}:`, err);
        }
    }
    console.log('Categories updated successfully!');
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=update_categories_from_prod.js.map