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
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const url = process.env.DATABASE_URL;
if (!url)
    throw new Error('DATABASE_URL is not defined');
const pool = new pg_1.Pool({ connectionString: url });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
async function getOrCreateCategory(name, parentId = null) {
    const slug = slugify(name);
    let category = await prisma.category.findFirst({
        where: {
            OR: [
                { slug },
                { name: { equals: name, mode: 'insensitive' } }
            ]
        }
    });
    if (!category) {
        category = await prisma.category.create({
            data: {
                name,
                slug,
                parentId,
                isAwin: true
            }
        });
    }
    else if (parentId && category.parentId !== parentId) {
        category = await prisma.category.update({
            where: { id: category.id },
            data: { parentId }
        });
    }
    return category;
}
async function main() {
    console.log('Fetching unique path-like categories from products...');
    const productsWithPaths = await prisma.product.groupBy({
        by: ['category'],
        where: {
            OR: [
                { category: { contains: ' > ' } },
                { category: { contains: ' &gt; ' } },
                { category: { contains: ' | ' } }
            ]
        }
    });
    console.log(`Found ${productsWithPaths.length} unique paths to process.`);
    for (const group of productsWithPaths) {
        const rawPath = group.category || '';
        const parts = rawPath.split(/\s*[>|]\s*|\s*&gt;\s*/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
            console.log(`Processing path: ${rawPath}`);
            let currentParentId = null;
            let leafName = '';
            for (const part of parts) {
                const cat = await getOrCreateCategory(part, currentParentId);
                currentParentId = cat.id;
                leafName = cat.name;
            }
            const updateCount = await prisma.product.updateMany({
                where: { category: rawPath },
                data: { category: leafName }
            });
            console.log(`Updated ${updateCount.count} products to category: ${leafName}`);
        }
    }
    console.log('Cleaning up Category table for any path-like names...');
    const catsWithPaths = await prisma.category.findMany({
        where: {
            OR: [
                { name: { contains: ' > ' } },
                { name: { contains: ' &gt; ' } },
                { name: { contains: ' | ' } }
            ]
        }
    });
    for (const cat of catsWithPaths) {
        const parts = cat.name.split(/\s*[>|]\s*|\s*&gt;\s*/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
            let currentParentId = null;
            let leafName = '';
            for (const part of parts) {
                const subCat = await getOrCreateCategory(part, currentParentId);
                currentParentId = subCat.id;
                leafName = subCat.name;
            }
            await prisma.product.updateMany({
                where: { category: cat.name },
                data: { category: leafName }
            });
            try {
                await prisma.category.delete({ where: { id: cat.id } });
            }
            catch (e) {
            }
        }
    }
    console.log('Done.');
}
main().catch(console.error).finally(() => { prisma.$disconnect(); pool.end(); });
//# sourceMappingURL=split_categories.js.map