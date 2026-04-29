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
async function main() {
    console.log('Checking for missing Category records...');
    const productCategories = await prisma.product.groupBy({
        by: ['category'],
        where: { category: { not: null } },
    });
    console.log(`Found ${productCategories.length} unique category names in Product table.`);
    const existingCategories = await prisma.category.findMany({
        select: { name: true }
    });
    const categoryNames = new Set(existingCategories.map(c => c.name.toLowerCase().trim()));
    const missing = [];
    for (const pc of productCategories) {
        const name = pc.category;
        if (!categoryNames.has(name.toLowerCase().trim())) {
            missing.push(name);
        }
    }
    console.log(`Found ${missing.length} category names in Product table that are missing from Category table.`);
    if (missing.length > 0) {
        console.log('First 10 missing:', missing.slice(0, 10));
        console.log('Syncing missing categories...');
        let createdCount = 0;
        for (const name of missing) {
            if (!name)
                continue;
            const slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
            try {
                await prisma.category.create({
                    data: {
                        name: name,
                        slug: slug,
                        isAwin: true,
                        isDeleted: false
                    }
                });
                createdCount++;
            }
            catch (e) {
                console.warn(`Failed to create category ${name}: ${e.message}`);
            }
        }
        console.log(`Created ${createdCount} missing Category records.`);
    }
    else {
        console.log('All product categories are in sync with Category table!');
    }
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
//# sourceMappingURL=check_missing_categories.js.map