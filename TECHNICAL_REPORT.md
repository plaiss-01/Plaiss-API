# Plaiss Technical Report: Importing Pipeline and Project Work

Date: May 9, 2026

## 1. Executive Summary

Plaiss is built as a product catalog platform backed by a NestJS API, Prisma, PostgreSQL, and a Next.js frontend. The most important backend workflow is the AWIN importing pipeline. It brings supplier product data into controlled staging tables, transforms it into clean catalog data, promotes approved data into production, and then syncs it into the main `Product` table consumed by the storefront.

The current project work focuses on four connected areas:

- AWIN data importing from feed URLs and CSV uploads.
- Product transformation, normalization, promotion, and catalog synchronization.
- Category management for linking AWIN source categories to manual storefront categories.
- Frontend catalog browsing, filtering, and count reconciliation, especially for sofas, sizes, and materials.

The import system is functional and already supports large feeds through streaming, batched inserts, background jobs, progress polling, and a three-step admin workflow. The latest frontend fixes also make category totals and dynamic filter counts line up more reliably by loading the full category product set and normalizing size/material facets before rendering filters.

## 2. Project Architecture

### Backend

Repository: `Plaiss-API`

Technology stack:

- NestJS application framework.
- Prisma ORM.
- PostgreSQL database.
- `fast-csv` for CSV parsing.
- Axios/HTTP streaming for remote AWIN feed downloads.
- Swagger decorators on API controllers.

Main backend modules:

- `AwinModule`: AWIN product imports, product API, promotion, deletion, deduplication, and import status.
- `CategoryModule`: manual categories, AWIN source categories, merging, linking, and category sync.
- `UploadModule`: S3 image upload support.
- `BlogModule`: blog post CRUD.
- `UsersModule`: user APIs.
- `VisualSearchModule`: image-based search support.
- `PrismaModule`: database access.

### Frontend

Repository: `Plaiss`

Technology stack:

- Next.js frontend.
- Admin dashboard for product/import/category management.
- Storefront category pages and product filtering.
- API integration through `NEXT_PUBLIC_API_URL`.

Key frontend areas:

- Admin AWIN import pipeline UI.
- Admin product and category management.
- Storefront category pages.
- Product data mapping and caching.
- Dynamic filters for color, retailer, size, material, stock, sale, and sorting.

## 3. Importing Feature Overview

The importing feature is designed around a staged pipeline:

1. Extract AWIN data into RAW.
2. Transform RAW data into cleaned DEV rows.
3. Promote DEV rows into PROD and sync the main `Product` table.

This structure reduces risk because unprocessed supplier data is kept separate from normalized catalog data. It also gives the project a clear place to inspect, validate, and improve product mapping rules before products reach the storefront.

### Pipeline Tables

The backend creates and uses three AWIN pipeline tables:

| Stage | Table | Purpose |
| --- | --- | --- |
| RAW | `AWIN_AFFILIAT_PRODUCTS_DATA_RAW` | Stores original AWIN CSV rows as JSON with row number, source URL, job ID, and import timestamp. |
| DEV | `AWIN_AFFILIAT_PRODUCTS_DATA_DEV` | Stores transformed rows with cleaned product fields, inferred values, pricing, category, material/model, size, and flags. |
| PROD | `AWIN_AFFILIAT_PRODUCTS_DATA_PROD` | Stores promoted product rows that are ready to sync into the main storefront catalog. |

The API exposes a table summary endpoint so the admin UI can show counts for RAW, DEV, PROD, and total imported rows.

## 4. Import Entry Points

The backend supports both the new staged pipeline and older direct import paths.

### Pipeline Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/awin/pipeline/tables` | Returns pipeline table names and row counts. |
| `POST` | `/api/awin/pipeline/extract-raw` | Downloads an AWIN feed URL and imports rows into RAW. |
| `POST` | `/api/awin/pipeline/upload-raw-csv` | Uploads a CSV file and imports rows into RAW. |
| `POST` | `/api/awin/pipeline/transform-dev` | Transforms RAW rows into cleaned DEV rows. |
| `POST` | `/api/awin/pipeline/promote-prod` | Promotes DEV rows to PROD and syncs the main `Product` table. |
| `GET` | `/api/awin/import-status/:id` | Returns background job status, progress, result, or failure message. |

### Legacy Import Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/awin/upload-csv` | Directly imports a CSV into the main product catalog. |
| `POST` | `/api/awin/add-product` | Imports a single product from an AWIN product URL. |

The staged pipeline should be treated as the primary long-term import path. The legacy endpoints are still useful for quick manual imports, targeted fixes, or back-office operations.

## 5. Import Pipeline Details

### Step 1: Extract to RAW

The RAW extraction step accepts either:

- A remote AWIN datafeed/download URL.
- A manually uploaded AWIN CSV file.

For remote feeds, the backend applies AWIN download defaults when needed:

- CSV format.
- Gzip compression.
- Any/all requested columns.

The feed is streamed instead of fully loading into memory. Gzip responses are detected from URL or response headers, then decompressed and parsed row by row.

RAW import behavior:

- Creates pipeline tables if they do not already exist.
- Optionally truncates RAW before import when `replace` is enabled.
- Parses CSV rows with headers.
- Inserts rows in batches.
- Stores the complete original row as JSONB.
- Tracks `row_number`, `source_url`, `import_job_id`, and `imported_at`.
- Updates progress every 1000 rows.

This approach is appropriate for large AWIN files because it avoids memory-heavy full-file processing.

### Step 2: Transform RAW to DEV

The transform step reads RAW rows and maps supplier data into catalog-ready fields.

Important transformation behavior:

- Validates required product values.
- Requires an AWIN product ID.
- Requires a product name.
- Requires price and image URL.
- Extracts usable category data from product type, merchant category, and category path.
- Filters out non-sofa or collection-like content where applicable.
- Normalizes product model/material signals.
- Normalizes color.
- Infers size/stock status.
- Infers recliner and sofa bed flags.
- Calculates base SKU and variant number.
- Cleans original price, discounted price, saving, and sales discount.
- Preserves the original raw row for audit/debugging.

Rows that cannot be mapped safely are skipped instead of promoted blindly. This is important because supplier feeds often contain missing fields, inconsistent categories, or mixed product types.

The current DEV table includes fields such as:

- `aw_product_id`
- `merchant_product_id`
- `product_name`
- `slug`
- `description`
- `search_price`
- `currency`
- `image_url`
- `product_url`
- `merchant_name`
- `category_name`
- `merchant_category`
- `category_id`
- `brand_name`
- `colour`
- `product_model`
- `product_type`
- `product_model_clean`
- `colour_clean`
- `size_stock_status_clean`
- `is_recliner`
- `is_sofa_bed`
- `base_sku`
- `colour_variant_number`
- `original_price_clean`
- `discounted_price_clean`
- `saving`
- `sales_discount`
- `raw_row`
- `transformed_at`

### Step 3: Promote DEV to PROD

The promotion step copies DEV data into PROD. It can replace existing PROD data or upsert into it, depending on request options.

Promotion behavior:

- Creates missing pipeline tables.
- Optionally truncates PROD before loading.
- Copies transformed DEV rows into PROD.
- Marks rows with `loaded_at`.
- Upserts by `aw_product_id`.
- Optionally syncs PROD rows into the main Prisma `Product` table.

The promote step also clears product cache so frontend catalog requests receive fresh product data after the sync.

### Step 4: Sync PROD to Product

The final catalog sync reads promoted rows from PROD and writes them into the main `Product` model.

Synced product fields include:

- Name and slug.
- Description.
- Price and currency.
- Image URL and product URL.
- Merchant.
- Category and internal category relation.
- Merchant product ID.
- Merchant category.
- AWIN category ID.
- Brand.
- Colour.
- Product model/material.
- Product type.
- Size stock status.
- Saving, base price, and display price.
- AWIN ID.

The sync also normalizes product attributes into the attribute tables:

- Brand.
- Colour.
- Product type.
- Model.
- Size.
- Recliner.
- Sofa bed.

This makes products searchable and filterable through structured attributes, not only through raw text fields.

## 6. Import Job Status and Admin Progress

Import jobs are tracked through `ImportStatusService`.

Job status includes:

- Job ID.
- Status.
- Current progress.
- Human-readable message.
- Result data on completion.
- Failure message on error.

The admin dashboard starts each import step, receives a job ID, and polls `/api/awin/import-status/:id` every two seconds. The UI shows busy state, progress, table counts, and latest result.

Current implementation note:

- Job state is stored in process memory.
- Jobs expire after a maximum age.
- The service keeps a maximum number of tracked jobs.

This is simple and fast for one API process. For multi-instance deployment, job state should move to PostgreSQL or Redis so polling works consistently across processes.

## 7. Admin Import UI

The admin dashboard includes a dedicated AWIN pipeline view.

Main UI capabilities:

- Shows RAW, DEV, and PROD table counts.
- Accepts an AWIN feed/download URL.
- Supports CSV file upload into RAW.
- Starts RAW extraction.
- Starts RAW to DEV transformation.
- Starts DEV to PROD promotion.
- Confirms promotion before syncing to catalog.
- Polls job progress and displays results.
- Refreshes table counts and products after completion.

The UI mirrors the backend pipeline, which makes the import process clear for admins:

1. Load supplier data.
2. Transform and clean it.
3. Promote it to live catalog data.

## 8. Category Management Work

The category system supports both manual storefront categories and AWIN source categories.

Important behavior:

- AWIN categories can be synced from imported products.
- Manual categories can be created and ordered.
- AWIN categories can be linked under manual parent categories.
- Product category strings can be updated when AWIN source categories are linked to manual categories.
- Merging can move products and child categories into an existing category.
- The category structure is cached briefly for storefront performance.

This supports a practical merchandising workflow. Supplier categories can remain traceable, while storefront categories can stay clean and customer-friendly.

## 9. Product Catalog and Frontend Filter Work

The frontend catalog consumes products from `/api/awin/products` and maps backend product fields into frontend product cards and category pages.

Recent product/category filter work focused on count accuracy and filter quality.

### Category Total Fix

Problem:

- The sofa category was showing 1000 products even when the real category total was higher.
- Filter quantities did not match the visible/main category count.

Cause:

- The backend product endpoint caps a single request at 1000 products.
- The frontend category page needed the full category dataset for accurate dynamic filter counts.

Fix:

- The frontend product loader now follows backend pagination and loads additional pages when a category page requests the full category dataset.
- Sofa totals and filter totals are now calculated from the same active product pool.

Observed verification:

- Sofa API category total: 1625.
- Frontend category loading: 1625 products.
- Size filter bucket total: 1625.
- Material filter bucket total: 1625.

### Size Filter Fix

Problem:

- Sofa size filters displayed irrelevant values such as chair-related labels.
- Size filter quantities did not reconcile with the category total.

Fix:

- Size labels are normalized before display.
- Sofa size options now use customer-facing buckets such as:
  - `1 Seater`
  - `2 Seater`
  - `3 Seater`
  - `4 Seater`
  - `5 Seater`
  - `6 Seater`
  - `Corner`
  - `Sofa Bed`
  - `Other`
- Irrelevant raw values are removed from the visible sofa size filter.
- `Other` is retained so every product can still be counted.
- Filtering now uses normalized size labels instead of raw supplier values.

### Material Filter Fix

Problem:

- The material filter was using inconsistent raw fields.
- Some values came from model-like or irrelevant product data.
- Material quantities did not reliably match the category total.

Fix:

- Material labels are inferred from structured attributes first, then safe product fields.
- Raw `productModel` is no longer displayed directly as a material label.
- Materials are normalized into clean customer-facing buckets such as:
  - `Leather`
  - `Faux Leather`
  - `Fabric`
  - `Velvet`
  - `Chenille`
  - `Boucle`
  - `Linen`
  - `Cotton`
  - `Polyester`
  - `Wool`
  - `Suede`
  - `Microfibre`
  - `Rattan`
  - `Wicker`
  - `Wood`
  - `Metal`
  - `Other`
- `Other` ensures product counts reconcile even when supplier data is incomplete.
- Desktop and mobile filter UIs now use the same normalized material counts.

## 10. Product API and Storefront Features

The AWIN/product API supports:

- Product listing.
- Product search/filter query parameters.
- Mixed brand product retrieval.
- Merchant listing.
- Brand listing.
- Category listing.
- Product lookup by slug or ID.
- Product update.
- Product deletion.
- Product deletion by merchant.
- Product deduplication.

The storefront uses this API for:

- Category pages.
- Product grids.
- Product counts.
- Dynamic filters.
- Sorting.
- Product detail navigation.
- Merchant/brand/category browsing.

## 11. Data Model Summary

Core Prisma models used by the importing and catalog features:

- `Product`: main storefront product table.
- `Category`: manual and AWIN category tree.
- `Attribute`: normalized attribute name, such as Brand or Size.
- `AttributeValue`: normalized value for an attribute.
- `ProductAttribute`: many-to-many product-to-attribute-value link.
- `ProductColorVariant`: product variant records for color/product variation handling.
- `BlogPost`: content management.
- User-related models for account/user support.

The current product model stores both direct searchable fields and normalized attribute links. This gives the frontend simple fields for rendering while preserving structured filter data.

## 12. Validation and Quality Controls

Current import quality controls:

- RAW keeps full original rows for auditability.
- DEV rows are skipped when required fields are missing.
- Product IDs are upserted by AWIN ID to avoid duplicate imports.
- Category creation and linking keep supplier categories traceable.
- Price fields are cleaned before product sync.
- Colour, size, model/material, recliner, and sofa bed values are inferred.
- Frontend filters normalize messy supplier values before display.
- Category filter counts are calculated from the same loaded product pool as the product grid.

Current verification performed for the latest frontend work:

- Frontend type check passed.
- Frontend production build passed.
- Sofa product category count was checked against API data.
- Sofa size bucket totals reconcile to the sofa category total.
- Sofa material bucket totals reconcile to the sofa category total.

## 13. Known Limitations

The project is in good working shape, but several areas should be strengthened before heavy production use.

### Import Job Persistence

Import job status is currently in memory. If the API restarts during an import, job status is lost. In a multi-instance deployment, polling may hit a different instance from the one running the job.

Recommendation:

- Move job status to PostgreSQL or Redis.
- Store job start/end timestamps, status, counts, and errors.
- Add an admin job history view.

### DEV Review Workflow

The RAW to DEV to PROD structure is strong, but the admin UI currently promotes the transformed data as a full step. A deeper review workflow would improve safety.

Recommendation:

- Add a DEV table browser in admin.
- Show skipped row counts and skip reasons.
- Allow admins to sample transformed rows before promotion.
- Add validation badges for missing image, invalid price, weak category, and unknown material/size.

### Backend Facet Aggregation

The frontend now normalizes size/material filters correctly, but filter counts are still frontend-calculated for category pages.

Recommendation:

- Add backend facet endpoints for category filter counts.
- Reuse the same normalization rules in backend import or product APIs.
- Return category total, size facets, material facets, retailer facets, and color facets from one source of truth.

### Material and Size Source of Truth

Some material and size normalization now happens in frontend logic so the customer-facing UI is clean.

Recommendation:

- Push final normalized material and size fields into the backend product model during import sync.
- Keep frontend logic as a defensive display layer only.

### Testing

The import pipeline should have more automated coverage.

Recommended tests:

- RAW CSV parsing.
- Gzip AWIN feed extraction.
- Required-field validation.
- RAW to DEV mapping rules.
- DEV to PROD promotion.
- PROD to `Product` sync.
- Category linking and merge behavior.
- Size/material facet count reconciliation.

## 14. Recommended Next Work

Priority 1:

- Persist import jobs in the database or Redis.
- Add backend tests for AWIN transform and promotion.
- Add an admin DEV review table before promotion.

Priority 2:

- Move normalized material and size fields into backend sync.
- Add backend facet/count endpoints for storefront category pages.
- Add import audit logs and downloadable import summaries.

Priority 3:

- Add scheduled AWIN feed refresh support.
- Add retry handling for failed feed downloads.
- Add alerting for failed imports or abnormal skipped-row counts.
- Add product image validation and stale product handling.

## 15. Primary Files

Backend:

- `src/awin/awin.controller.ts`: AWIN import and product API endpoints.
- `src/awin/awin.service.ts`: import pipeline, transformations, promotion, sync, product operations.
- `src/awin/import-status.service.ts`: background job status tracking.
- `src/category/category.service.ts`: category sync, link, merge, and hierarchy logic.
- `prisma/schema.prisma`: product, category, attributes, variants, users, and blog schema.
- `src/app.module.ts`: backend module registration.

Frontend:

- `src/app/admin/dashboard/page.tsx`: admin import pipeline and category/product management UI.
- `src/lib/products.ts`: product API fetch, mapping, caching, and category pagination.
- `src/features/category/category-client.tsx`: storefront category filters, size/material normalization, counts, sorting, and grid behavior.

## 16. Conclusion

The Plaiss import system now has a clear staged architecture: RAW preserves supplier truth, DEV applies catalog rules, PROD represents promotable data, and the main `Product` table powers the storefront. The admin UI exposes this flow in a practical three-step workflow, while the frontend catalog now calculates category and filter counts from complete category data instead of partial 1000-product pages.

The most valuable next improvement is to move import status and final facet normalization further into backend-owned, persistent systems. That will make the pipeline more reliable, easier to audit, and better prepared for scheduled production imports.
