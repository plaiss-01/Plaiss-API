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
        console.log('Testing Prisma connection and queries...');
        const productCount = await prisma.product.count();
        console.log('Total Products in PROD table:', productCount);
        const variantCount = await prisma.productColorVariant.count();
        console.log('Total Color Variants in table:', variantCount);
        console.log('Fetching a sample product to verify schema update...');
        const sample = await prisma.product.findFirst({
            select: { id: true, name: true, salesDiscount: true }
        });
        console.log('Sample Product:', sample);
        console.log('\nVerifying that we can query with include (which failed originally)...');
        const sampleWithVariants = await prisma.product.findFirst({
            where: { id: sample?.id },
            include: { colorVariants: true }
        });
        console.log('Sample with variants included successfully!');
        console.log('\n[SUCCESS] All code and database checks passed!');
    }
    catch (e) {
        console.error('\n[ERROR] Check failed:', e);
    }
    finally {
        await prisma.$disconnect();
        await pool.end();
    }
}
run();
//# sourceMappingURL=verify_all.js.map