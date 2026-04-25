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
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
async function main() {
    console.log('Extracting and parsing hierarchical categories from Products...');
    const products = await prisma.product.findMany({
        select: { category: true }
    });
    const uniqueCategoryPaths = new Set();
    products.forEach(p => {
        if (p.category) {
            uniqueCategoryPaths.add(p.category.trim());
        }
    });
    console.log(`Found ${uniqueCategoryPaths.size} unique category paths.`);
    for (const pathStr of uniqueCategoryPaths) {
        const parts = pathStr.split(' > ').map(p => p.trim());
        let lastParentId = null;
        for (let i = 0; i < parts.length; i++) {
            const name = parts[i];
            const slug = slugify(name);
            try {
                const category = await prisma.category.upsert({
                    where: { name },
                    update: {
                        parentId: lastParentId
                    },
                    create: {
                        name,
                        slug,
                        parentId: lastParentId,
                        isAwin: true
                    }
                });
                lastParentId = category.id;
            }
            catch (err) {
                const existing = await prisma.category.findUnique({ where: { name } });
                if (existing) {
                    lastParentId = existing.id;
                }
                else {
                    console.error(`Error processing category "${name}": ${err.message}`);
                }
            }
        }
    }
    const finalCount = await prisma.category.count();
    console.log(`Hierarchy populated. Total categories in DB: ${finalCount}`);
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
//# sourceMappingURL=populate-categories.js.map