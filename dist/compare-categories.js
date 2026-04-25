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
const HARDCODED_NAMES = [
    'Living Room', 'Seating', 'Sofas', 'Armchairs', 'Corner Sofas', 'Footstools',
    'Storage', 'TV Units', 'Bookcases', 'Sideboards', 'Coffee Tables',
    'Bedroom', 'Beds', 'Double Beds', 'King Size Beds', 'Storage Beds', 'Guest Beds',
    'Furniture', 'Wardrobes', 'Chest of Drawers', 'Bedside Tables', 'Dressing Tables',
    'Kitchen & Dining', 'Dining', 'Dining Tables', 'Dining Chairs', 'Dining Sets', 'Bar Stools',
    'Kitchen', 'Kitchen Storage', 'Cookware', 'Tableware',
    'Garden & Outdoor', 'Garden Furniture', 'Garden Dining Sets', 'Garden Sofas', 'Sun Loungers',
    'Lighting', 'Indoor', 'Ceiling Lights', 'Floor Lamps', 'Table Lamps', 'Wall Lights'
];
async function compareCategories() {
    console.log('Comparing Hardcoded vs Database Categories...\n');
    const dbCategories = await prisma.category.findMany();
    const dbNames = new Set(dbCategories.map((c) => c.name.toLowerCase().trim()));
    const report = HARDCODED_NAMES.map(name => {
        const exists = dbNames.has(name.toLowerCase().trim());
        return {
            'Hardcoded Name': name,
            'Status': exists ? '✅ Match' : '❌ Missing in DB',
            'Action Needed': exists ? 'None' : `Create category "${name}"`
        };
    });
    console.table(report);
    const missingCount = report.filter(r => r.Status.includes('Missing')).length;
    if (missingCount > 0) {
        console.log(`\nWarning: ${missingCount} categories in the Megamenu do not exist in the database.`);
        console.log('To fix this, you should run a script to create these missing records.');
    }
    else {
        console.log('\nAll hardcoded categories are perfectly synced with the database!');
    }
    await prisma.$disconnect();
}
compareCategories().catch(console.error);
//# sourceMappingURL=compare-categories.js.map