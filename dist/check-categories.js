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
async function checkCategories() {
    console.log('Checking products per category...');
    const categories = await prisma.product.groupBy({
        by: ['category'],
        _count: {
            _all: true
        }
    });
    console.log('\nProducts per Category:');
    console.table(categories.map(c => ({
        Category: c.category || 'None',
        Count: c._count._all
    })));
    const mainCategories = ['Furniture', 'Living Room', 'Bedroom', 'Kitchen', 'Outdoor', 'Lighting', 'Decor'];
    console.log('\nChecking matches for main categories (using contains):');
    for (const main of mainCategories) {
        const count = await prisma.product.count({
            where: {
                category: {
                    contains: main,
                    mode: 'insensitive'
                }
            }
        });
        console.log(`${main}: ${count} products`);
    }
    await prisma.$disconnect();
}
checkCategories().catch(console.error);
//# sourceMappingURL=check-categories.js.map