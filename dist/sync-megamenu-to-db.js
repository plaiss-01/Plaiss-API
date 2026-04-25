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
const MEGA_MENU_STRUCTURE = [
    {
        name: 'Living Room',
        children: [
            { name: 'Seating', children: ['Sofas', 'Armchairs', 'Corner Sofas', 'Footstools'] },
            { name: 'Storage', children: ['TV Units', 'Bookcases', 'Sideboards', 'Coffee Tables'] }
        ]
    },
    {
        name: 'Bedroom',
        children: [
            { name: 'Beds', children: ['Double Beds', 'King Size Beds', 'Storage Beds', 'Guest Beds'] },
            { name: 'Furniture', children: ['Wardrobes', 'Chest of Drawers', 'Bedside Tables', 'Dressing Tables'] }
        ]
    },
    {
        name: 'Kitchen & Dining',
        children: [
            { name: 'Dining', children: ['Dining Tables', 'Dining Chairs', 'Dining Sets', 'Bar Stools'] },
            { name: 'Kitchen', children: ['Kitchen Storage', 'Cookware', 'Tableware'] }
        ]
    },
    {
        name: 'Garden & Outdoor',
        children: [
            { name: 'Garden Furniture', children: ['Garden Dining Sets', 'Garden Sofas', 'Sun Loungers'] }
        ]
    },
    {
        name: 'Lighting',
        children: [
            { name: 'Indoor', children: ['Ceiling Lights', 'Floor Lamps', 'Table Lamps', 'Wall Lights'] }
        ]
    }
];
function slugify(text) {
    return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
async function syncMenu() {
    console.log('Syncing Megamenu structure to Database...\n');
    for (const root of MEGA_MENU_STRUCTURE) {
        let rootRecord = await prisma.category.findFirst({
            where: { name: { equals: root.name, mode: 'insensitive' } }
        });
        if (!rootRecord) {
            rootRecord = await prisma.category.create({
                data: { name: root.name, slug: slugify(root.name), isAwin: false }
            });
            console.log(`+ Created Root: ${root.name}`);
        }
        else {
            rootRecord = await prisma.category.update({
                where: { id: rootRecord.id },
                data: { slug: slugify(root.name), parentId: null }
            });
        }
        for (const mid of root.children) {
            let midRecord = await prisma.category.findFirst({
                where: { name: { equals: mid.name, mode: 'insensitive' } }
            });
            if (!midRecord) {
                midRecord = await prisma.category.create({
                    data: { name: mid.name, slug: slugify(mid.name), parentId: rootRecord.id, isAwin: false }
                });
                console.log(`  + Created Mid: ${mid.name} (under ${root.name})`);
            }
            else {
                midRecord = await prisma.category.update({
                    where: { id: midRecord.id },
                    data: { slug: slugify(mid.name), parentId: rootRecord.id }
                });
            }
            for (const leafName of mid.children) {
                let leafRecord = await prisma.category.findFirst({
                    where: { name: { equals: leafName, mode: 'insensitive' } }
                });
                if (!leafRecord) {
                    leafRecord = await prisma.category.create({
                        data: { name: leafName, slug: slugify(leafName), parentId: midRecord.id, isAwin: false }
                    });
                    console.log(`    + Created Leaf: ${leafName} (under ${mid.name})`);
                }
                else {
                    leafRecord = await prisma.category.update({
                        where: { id: leafRecord.id },
                        data: { slug: slugify(leafName), parentId: midRecord.id }
                    });
                }
            }
        }
    }
    console.log('\nSync complete! All Megamenu categories now exist in the database.');
    await prisma.$disconnect();
}
syncMenu().catch(console.error);
//# sourceMappingURL=sync-megamenu-to-db.js.map