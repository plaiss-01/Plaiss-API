"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function run() {
    try {
        console.log('Fetching all products with color variants (using select to avoid bad data)...');
        const allProducts = await prisma.product.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                colour: true,
                imageUrl: true,
                productUrl: true,
                colorVariants: true,
            }
        });
        console.log(`Found ${allProducts.length} products.`);
        const groups = new Map();
        allProducts.forEach((p) => {
            let coreName = p.name
                .toLowerCase()
                .replace(/\b(fabric|leather|velvet|chenille|linen|wood|metal|glass|gloss|matt|oak|pine|walnut|ash|marble)\b/gi, '')
                .replace(/\b(\d+)\s*(seater|piece|set|pack|kg|g|cm|mm|m)\b/gi, '')
                .replace(/^[0-9\s-]+/, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (coreName.length < 5)
                coreName = p.name.toLowerCase().trim();
            const key = `${coreName}`;
            const group = groups.get(key) || [];
            group.push(p);
            groups.set(key, group);
        });
        console.log(`Grouped into ${groups.size} unique core names.`);
        let mergedCount = 0;
        let variantCount = 0;
        for (const [key, products] of groups.entries()) {
            if (products.length <= 1)
                continue;
            console.log(`\nProcessing group: "${key}" (${products.length} products)`);
            const sorted = products.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
            const master = sorted[0];
            const variants = sorted.slice(1);
            console.log(`  Master: ${master.name} (ID: ${master.id})`);
            for (const v of variants) {
                try {
                    console.log(`  Merging Variant: ${v.name} (ID: ${v.id})`);
                    const colorName = v.colour || v.name.split(' ').find((word) => ['red', 'blue', 'green', 'black', 'white', 'grey', 'gray', 'yellow', 'pink', 'purple', 'brown', 'beige', 'cream', 'teal', 'navy', 'charcoal', 'silver', 'gold'].includes(word.toLowerCase())) || 'Original';
                    await prisma.productColorVariant.upsert({
                        where: { awinId: v.id },
                        update: {
                            colorName,
                            imageUrl: v.imageUrl,
                            productUrl: v.productUrl,
                            productId: master.id,
                        },
                        create: {
                            awinId: v.id,
                            colorName,
                            imageUrl: v.imageUrl,
                            productUrl: v.productUrl,
                            productId: master.id,
                        },
                    });
                    if (v.colorVariants && v.colorVariants.length > 0) {
                        await prisma.productColorVariant.updateMany({
                            where: { productId: v.id },
                            data: { productId: master.id }
                        });
                    }
                    await pool.query(`
            DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
            WHERE "aw_product_id" = $1
          `, [v.id]);
                    mergedCount++;
                    variantCount++;
                }
                catch (err) {
                    console.error(`  Failed to merge ${v.name} into ${master.name}:`, err.message);
                }
            }
        }
        console.log(`\nDeduplication complete. Merged ${mergedCount} products into variants.`);
    }
    catch (e) {
        console.error('Error during execution:', e);
    }
    finally {
        await prisma.$disconnect();
        await pool.end();
    }
}
run();
//# sourceMappingURL=deduplicate.js.map