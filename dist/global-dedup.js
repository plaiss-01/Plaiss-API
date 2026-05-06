"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
const COLORS = [
    'Grey', 'Gray', 'Cream', 'Blue', 'Navy', 'Black', 'White', 'Red', 'Green', 'Yellow',
    'Pink', 'Purple', 'Orange', 'Brown', 'Beige', 'Teal', 'Silver', 'Gold', 'Charcoal', 'Anthracite',
    'Tan', 'Mocha', 'Saddle', 'Stone', 'Mellow Brown', 'Light Grey', 'Dark Grey', 'Slate', 'Ivory',
    'Sand', 'Sage', 'Ochre', 'Mustard', 'Terracotta', 'Rust', 'Burgundy', 'Wine', 'Emerald', 'Forest Green',
    'Teal Blue', 'Midnight Blue', 'Cool Grey', 'Warm Grey', 'Ash', 'Oak', 'Walnut', 'Pine', 'Beech'
];
const MATERIALS = [
    'Fabric', 'Leather', 'Velvet', 'Faux Leather', 'Plush Velvet', 'Woven', 'Rattan', 'Poly Rattan', 'Metal', 'Steel', 'Aluminium', 'Wooden', 'Oak', 'Walnut', 'Pine'
];
function getNormalizedName(name) {
    let normalized = name.toLowerCase();
    normalized = normalized.replace(/^\d+\s+/, '').replace(/^[a-z]\s+/, '');
    for (const mat of MATERIALS) {
        const regex = new RegExp(`\\b${mat.toLowerCase()}\\b`, 'gi');
        normalized = normalized.replace(regex, '');
    }
    for (const color of COLORS) {
        const regex = new RegExp(`[\\s\\-,\\/]*(in|with|color|colour)?\\s*${color.toLowerCase()}\\b`, 'gi');
        normalized = normalized.replace(regex, '');
    }
    return normalized.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
async function main() {
    console.log('Starting FINAL Aggressive Deduplication (Materials + Colors)...');
    const products = await prisma.product.findMany({
        select: { id: true, name: true, colour: true, imageUrl: true, productUrl: true, awinId: true, merchant: true, brandName: true }
    });
    console.log(`Analyzing ${products.length} products...`);
    const groups = new Map();
    for (const p of products) {
        const key = `${p.merchant}|${getNormalizedName(p.name)}`;
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(p);
    }
    let mergedCount = 0;
    let variantCount = 0;
    for (const [key, items] of groups.entries()) {
        if (items.length > 1) {
            const primary = items[0];
            const variants = items.slice(1);
            console.log(`Grouping ${items.length} items for: ${primary.name}`);
            for (const variant of variants) {
                let colorName = variant.colour || 'Unknown';
                if (colorName === 'Unknown' || !colorName) {
                    for (const color of COLORS) {
                        if (variant.name.toLowerCase().includes(color.toLowerCase())) {
                            colorName = color;
                            break;
                        }
                    }
                }
                try {
                    const existing = await prisma.productColorVariant.findFirst({
                        where: { productId: primary.id, colorName: colorName }
                    });
                    if (!existing) {
                        await prisma.productColorVariant.create({
                            data: {
                                productId: primary.id,
                                colorName: colorName,
                                imageUrl: variant.imageUrl,
                                productUrl: variant.productUrl,
                                awinId: variant.awinId,
                            }
                        });
                    }
                    await prisma.product.delete({ where: { id: variant.id } });
                    variantCount++;
                }
                catch (e) {
                }
            }
            mergedCount++;
        }
    }
    console.log(`Merge complete! Grouped ${mergedCount} products, created ${variantCount} variants.`);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=global-dedup.js.map