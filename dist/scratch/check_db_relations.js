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
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
    const client = await pool.connect();
    try {
        console.log('Checking database tables...');
        const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        const tableNames = tables.rows.map(r => r.table_name);
        console.log('Tables found:', tableNames);
        const hasProd = tableNames.includes('AWIN_AFFILIAT_PRODUCTS_DATA_PROD');
        const hasColor = tableNames.includes('ProductColorVariant');
        const hasAttr = tableNames.includes('ProductAttribute');
        console.log('AWIN_AFFILIAT_PRODUCTS_DATA_PROD exists:', hasProd);
        console.log('ProductColorVariant exists:', hasColor);
        console.log('ProductAttribute exists:', hasAttr);
        if (hasProd && hasColor) {
            console.log('Checking for orphans in ProductColorVariant...');
            const orphansColor = await client.query(`
        SELECT COUNT(*) FROM "ProductColorVariant" pcv
        LEFT JOIN "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p ON pcv."productId" = p.aw_product_id
        WHERE p.aw_product_id IS NULL AND pcv."productId" IS NOT NULL
      `);
            console.log('Orphan Color Variants (no matching product):', orphansColor.rows[0].count);
            const totalColor = await client.query(`SELECT COUNT(*) FROM "ProductColorVariant"`);
            console.log('Total Color Variants:', totalColor.rows[0].count);
        }
        if (hasProd && hasAttr) {
            console.log('Checking for orphans in ProductAttribute...');
            const orphansAttr = await client.query(`
        SELECT COUNT(*) FROM "ProductAttribute" pa
        LEFT JOIN "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p ON pa."productId" = p.aw_product_id
        WHERE p.aw_product_id IS NULL AND pa."productId" IS NOT NULL
      `);
            console.log('Orphan Attributes (no matching product):', orphansAttr.rows[0].count);
            const totalAttr = await client.query(`SELECT COUNT(*) FROM "ProductAttribute"`);
            console.log('Total Attributes:', totalAttr.rows[0].count);
        }
    }
    catch (e) {
        console.error('Error during check:', e);
    }
    finally {
        client.release();
        await pool.end();
    }
}
check();
//# sourceMappingURL=check_db_relations.js.map