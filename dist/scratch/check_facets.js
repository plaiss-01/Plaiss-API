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
        console.log('Checking for Velvet in Product table...');
        const countVelvet = await client.query(`
      SELECT COUNT(*) FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE "product_name" ILIKE '%velvet%' OR "description" ILIKE '%velvet%'
    `);
        console.log('Products with "Velvet" in name or description:', countVelvet.rows[0].count);
        console.log('\n--- Unique values of product_model ---');
        const models = await client.query(`
      SELECT "product_model" as val, COUNT(*) as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      WHERE "product_model" IS NOT NULL
      GROUP BY "product_model" 
      ORDER BY count DESC 
      LIMIT 10
    `);
        console.table(models.rows);
        console.log('\n--- Unique values of product_type ---');
        const types = await client.query(`
      SELECT "product_type" as val, COUNT(*) as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      WHERE "product_type" IS NOT NULL
      GROUP BY "product_type" 
      ORDER BY count DESC 
      LIMIT 10
    `);
        console.table(types.rows);
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
//# sourceMappingURL=check_facets.js.map