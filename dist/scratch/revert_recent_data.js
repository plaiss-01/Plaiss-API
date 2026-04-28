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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
});
const databaseUrl = env['DATABASE_URL'];
const pool = new pg_1.Pool({ connectionString: databaseUrl });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Finding recently added Awin categories...');
    const recentCategories = await prisma.category.findMany({
        where: {
            isAwin: true,
            createdAt: {
                gte: today
            }
        }
    });
    console.log(`Found ${recentCategories.length} recently added categories.`);
    if (recentCategories.length > 0) {
        const result = await prisma.category.deleteMany({
            where: {
                id: {
                    in: recentCategories.map(c => c.id)
                }
            }
        });
        console.log(`Deleted ${result.count} categories.`);
    }
    console.log('Clearing mapped category fields from recently added products...');
    const updatedProducts = await prisma.product.updateMany({
        where: {
            createdAt: {
                gte: today
            }
        },
        data: {
            categoryId: null,
            productType: null
        }
    });
    console.log(`Cleared category mappings for ${updatedProducts.count} products.`);
}
main().finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
//# sourceMappingURL=revert_recent_data.js.map