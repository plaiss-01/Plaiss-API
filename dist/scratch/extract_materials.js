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
const keywords = [
    'Faux Leather',
    'Velvet',
    'Chenille',
    'Boucle',
    'Linen',
    'Polyester',
    'Leather',
    'Fabric'
];
async function run() {
    const client = await pool.connect();
    try {
        console.log('Fetching products...');
        const res = await client.query(`
      SELECT "aw_product_id" as id, "product_name" as name, "description", "product_model_clean" as current_material
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    `);
        console.log(`Found ${res.rows.length} products.`);
        let updatedCount = 0;
        for (const row of res.rows) {
            const text = `${row.name} ${row.description || ''}`.toLowerCase();
            let detectedMaterial = null;
            for (const keyword of keywords) {
                if (text.includes(keyword.toLowerCase())) {
                    detectedMaterial = keyword;
                    break;
                }
            }
            if (detectedMaterial &&
                (row.current_material !== detectedMaterial || row.current_material === 'Unknown' || !row.current_material)) {
                await client.query(`
          UPDATE "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
          SET "product_model_clean" = $1
          WHERE "aw_product_id" = $2
        `, [detectedMaterial, row.id]);
                updatedCount++;
            }
        }
        console.log(`Successfully updated ${updatedCount} products with extracted materials.`);
        const newCounts = await client.query(`
      SELECT "product_model_clean" as val, COUNT(*) as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      WHERE "product_model_clean" IS NOT NULL
      GROUP BY "product_model_clean" 
      ORDER BY count DESC
    `);
        console.log('\n--- New Material Facets ---');
        console.table(newCounts.rows);
    }
    catch (e) {
        console.error('Error during execution:', e);
    }
    finally {
        client.release();
        await pool.end();
    }
}
run();
//# sourceMappingURL=extract_materials.js.map