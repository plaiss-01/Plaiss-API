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
async function checkSlugs() {
    console.log('Checking category table slugs...');
    const categories = await prisma.category.findMany();
    console.log(`Found ${categories.length} category records.`);
    const report = categories.map(c => ({
        ID: c.id,
        Name: c.name,
        Slug: c.slug,
        HasSlug: !!c.slug,
        IsRoot: !c.parentId
    }));
    console.table(report);
    const missingSlugs = categories.filter(c => !c.slug);
    if (missingSlugs.length > 0) {
        console.log(`\nWarning: ${missingSlugs.length} categories are missing slugs!`);
    }
    else {
        console.log('\nAll category records have slugs.');
    }
    await prisma.$disconnect();
}
checkSlugs().catch(console.error);
//# sourceMappingURL=check-slugs.js.map