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
const path = __importStar(require("path"));
dotenv.config({ path: path.resolve(__dirname, '.env') });
const url = process.env.DATABASE_URL;
if (!url)
    throw new Error('DATABASE_URL is not defined');
const pool = new pg_1.Pool({ connectionString: url });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
const KEYWORD_MAP = {
    'sofa': 'Furniture > Living Room > Sofas',
    'couch': 'Furniture > Living Room > Sofas',
    'armchair': 'Furniture > Living Room > Sofas',
    'coffee table': 'Furniture > Living Room > Tables',
    'side table': 'Furniture > Living Room > Tables',
    'tv unit': 'Furniture > Living Room > TV Units',
    'tv stand': 'Furniture > Living Room > TV Units',
    'sideboard': 'Furniture > Living Room > Sideboards',
    'double bed': 'Furniture > Bedroom > Beds',
    'king size bed': 'Furniture > Bedroom > Beds',
    'single bed': 'Furniture > Bedroom > Beds',
    'bed': 'Furniture > Bedroom > Beds',
    'mattress': 'Furniture > Bedroom > Mattresses',
    'wardrobe': 'Furniture > Bedroom > Storage',
    'chest of drawers': 'Furniture > Bedroom > Storage',
    'bedside table': 'Furniture > Bedroom > Tables',
    'dining table': 'Furniture > Kitchen & Dining > Tables',
    'dining chair': 'Furniture > Kitchen & Dining > Chairs',
    'kitchen': 'Home > Kitchen',
    'office chair': 'Furniture > Office > Chairs',
    'desk': 'Furniture > Office > Desks',
    'chair': 'Furniture > Seating',
    'table': 'Furniture > Tables',
    'cabinet': 'Furniture > Storage',
    'bookcase': 'Furniture > Storage > Bookcases',
    'pendant light': 'Home > Lighting > Ceiling Lights',
    'floor lamp': 'Home > Lighting > Floor Lamps',
    'table lamp': 'Home > Lighting > Table Lamps',
    'lighting': 'Home > Lighting',
    'lamp': 'Home > Lighting',
    'rug': 'Home > Textiles > Rugs',
    'cushion': 'Home > Textiles',
    'curtain': 'Home > Textiles',
    'mirror': 'Home > Decor',
    'vase': 'Home > Decor',
    'wall art': 'Home > Decor',
    'garden sofa': 'Home > Garden & Outdoor > Furniture',
    'patio': 'Home > Garden & Outdoor',
    'outdoor': 'Home > Garden & Outdoor',
};
async function autoCategorize() {
    console.log('Starting auto-categorization...');
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { category: null },
                { category: '' },
                { category: 'None' },
                { category: 'Storage' },
                { category: 'Chairs' }
            ]
        },
        select: {
            id: true,
            name: true,
        }
    });
    console.log(`Found ${products.length} products to categorize.`);
    let updatedCount = 0;
    const batchSize = 100;
    const sortedKeywords = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length);
    for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        await Promise.all(batch.map(async (p) => {
            const nameLower = p.name.toLowerCase();
            let matchedCategory = null;
            for (const keyword of sortedKeywords) {
                if (nameLower.includes(keyword)) {
                    matchedCategory = KEYWORD_MAP[keyword];
                    break;
                }
            }
            if (matchedCategory) {
                await prisma.product.update({
                    where: { id: p.id },
                    data: { category: matchedCategory }
                });
                updatedCount++;
            }
        }));
        if (i % 1000 === 0 && i > 0) {
            console.log(`Processed ${i} products... Updated ${updatedCount} so far.`);
        }
    }
    console.log(`\nAuto-categorization complete!`);
    console.log(`Total products processed: ${products.length}`);
    console.log(`Total products successfully categorized: ${updatedCount}`);
    await prisma.$disconnect();
}
autoCategorize().catch(console.error);
//# sourceMappingURL=auto-categorize.js.map