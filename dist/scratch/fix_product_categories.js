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
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const url = process.env.DATABASE_URL;
if (!url) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
}
const pool = new pg_1.Pool({ connectionString: url });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function extractLeafCategory(pathStr) {
    if (!pathStr)
        return 'collection';
    const parts = pathStr.split(/\s*[>|]\s*|\s*&gt;\s*/);
    return parts[parts.length - 1].trim() || 'collection';
}
async function main() {
    console.log('Optimizing synchronization process...');
    console.log('Grouping products by merchantProductCategoryPath...');
    const groups = await prisma.product.groupBy({
        by: ['merchantProductCategoryPath'],
        where: { merchantProductCategoryPath: { not: null } },
    });
    console.log(`Found ${groups.length} unique category paths. Updating products...`);
    let totalUpdated = 0;
    for (const group of groups) {
        const pathStr = group.merchantProductCategoryPath;
        const targetCategory = extractLeafCategory(pathStr);
        const result = await prisma.product.updateMany({
            where: {
                merchantProductCategoryPath: pathStr,
                category: { not: targetCategory }
            },
            data: { category: targetCategory }
        });
        totalUpdated += result.count;
    }
    console.log(`Updated ${totalUpdated} products via merchantProductCategoryPath.`);
    console.log('Checking for remaining products with category paths...');
    const products = await prisma.product.findMany({
        where: {
            merchantProductCategoryPath: null,
            OR: [
                { category: { contains: '>' } },
                { category: { contains: '|' } },
                { category: { contains: '&gt;' } }
            ]
        },
        select: { id: true, category: true }
    });
    console.log(`Found ${products.length} products with category paths but no merchant path.`);
    let individualUpdates = 0;
    for (const product of products) {
        const targetCategory = extractLeafCategory(product.category);
        if (product.category !== targetCategory) {
            await prisma.product.update({
                where: { id: product.id },
                data: { category: targetCategory }
            });
            individualUpdates++;
        }
    }
    console.log(`Updated ${individualUpdates} products individually.`);
    console.log(`Total synchronization complete! Total updated: ${totalUpdated + individualUpdates}`);
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
//# sourceMappingURL=fix_product_categories.js.map