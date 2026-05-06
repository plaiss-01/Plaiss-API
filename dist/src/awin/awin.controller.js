"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwinController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const awin_service_1 = require("./awin.service");
const prisma_service_1 = require("../prisma.service");
const create_product_dto_1 = require("./dto/create-product.dto");
const update_product_dto_1 = require("./dto/update-product.dto");
const import_status_service_1 = require("./import-status.service");
const category_service_1 = require("../category/category.service");
let AwinController = class AwinController {
    awinService;
    prisma;
    statusService;
    categoryService;
    constructor(awinService, prisma, statusService, categoryService) {
        this.awinService = awinService;
        this.prisma = prisma;
        this.statusService = statusService;
        this.categoryService = categoryService;
    }
    productsCache = new Map();
    categoriesCache = null;
    CACHE_TTL = 300000;
    MAX_CACHE_SIZE = 20;
    async addProduct(createProductDto) {
        return this.awinService.addProductFromUrl(createProductDto.url);
    }
    async uploadCsv(file) {
        const jobId = `csv-${Date.now()}`;
        this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting CSV file import...');
        this.awinService.processCsvFile(file.buffer, jobId).catch(e => {
            this.statusService.failJob(jobId, e.message);
        });
        return { jobId, message: 'CSV import started' };
    }
    async getImportStatus(id) {
        return this.statusService.getJob(id);
    }
    async getAllProducts(page = '1', limit = '50', category, subs, search) {
        const p = parseInt(page, 10) || 1;
        let l = parseInt(limit, 10) || 50;
        if (l > 1000)
            l = 1000;
        const skip = (p - 1) * l;
        const cacheKey = `products-${p}-${l}-${category || 'all'}`;
        const now = Date.now();
        if (this.productsCache.has(cacheKey)) {
            const cached = this.productsCache.get(cacheKey);
            if (now - cached.timestamp < this.CACHE_TTL) {
                return cached.data;
            }
        }
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { merchant: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
            ];
        }
        else if (category && category !== 'all-products') {
            const now = Date.now();
            if (!this.categoriesCache || now - this.categoriesCache.timestamp > this.CACHE_TTL) {
                const allCats = await this.categoryService.findAll();
                const categoryMap = new Map();
                const childrenMap = new Map();
                allCats.forEach(cat => {
                    categoryMap.set(cat.id, cat);
                    if (cat.parentId) {
                        const children = childrenMap.get(cat.parentId) || [];
                        children.push(cat);
                        childrenMap.set(cat.parentId, children);
                    }
                });
                this.categoriesCache = { data: allCats, categoryMap, childrenMap, timestamp: now };
            }
            const { data: allCats, categoryMap, childrenMap } = this.categoriesCache;
            const targetCats = allCats.filter(c => c.slug.toLowerCase() === category.toLowerCase() ||
                c.name.toLowerCase() === category.toLowerCase());
            console.log(`[getAllProducts] Query: "${category}", Found ${targetCats.length} target categories.`);
            const getDescendantIds = (catId, visited = new Set()) => {
                if (visited.has(catId))
                    return [];
                visited.add(catId);
                let ids = [catId];
                const children = childrenMap.get(catId) || [];
                for (const child of children) {
                    ids = ids.concat(getDescendantIds(child.id, visited));
                }
                return ids;
            };
            const allCategoryIds = [];
            const allCategoryNames = [];
            for (const cat of targetCats) {
                const children = childrenMap.get(cat.id) || [];
                if (children.length > 0) {
                    for (const child of children) {
                        const descendantIds = getDescendantIds(child.id);
                        allCategoryIds.push(...descendantIds);
                        descendantIds.forEach(id => {
                            const c = categoryMap.get(id);
                            if (c) {
                                allCategoryNames.push(c.name);
                                allCategoryNames.push(c.name.toLowerCase().trim());
                            }
                        });
                    }
                }
                else {
                    allCategoryIds.push(cat.id);
                    allCategoryNames.push(cat.name);
                    allCategoryNames.push(cat.name.toLowerCase().trim());
                }
            }
            if (subs) {
                const subArray = subs.split(',').map(s => s.replace(/\+/g, ' ').trim());
                allCategoryNames.push(...subArray);
                const subCats = allCats.filter(c => subArray.some(s => s.toLowerCase() === c.name.toLowerCase()));
                allCategoryIds.push(...subCats.map(c => c.id));
            }
            let uniqueIds = Array.from(new Set(allCategoryIds));
            let uniqueNames = Array.from(new Set(allCategoryNames));
            console.log(`[getAllProducts] Query: "${category}", IDs: ${uniqueIds.length}, Names: ${uniqueNames.length}`);
            where.OR = [
                { internalCategoryId: { in: uniqueIds } },
                { category: { in: uniqueNames, mode: 'insensitive' } },
                { merchantCategory: { in: uniqueNames, mode: 'insensitive' } },
            ];
        }
        let [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: l,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    imageUrl: true,
                    awThumbUrl: true,
                    largeImage: true,
                    category: true,
                    slug: true,
                    merchant: true,
                    productUrl: true,
                    description: true,
                    createdAt: true,
                    colour: true,
                    merchantCategory: true,
                    productType: true,
                    colorVariants: true,
                    attributes: {
                        select: {
                            attribute: { select: { name: true } },
                            attributeValue: { select: { value: true } }
                        }
                    }
                },
            }),
            this.prisma.product.count({ where }),
        ]);
        if (total === 0 && category && category !== 'all-products') {
            console.log(`[getAllProducts] No products found for "${category}". Trying parent fallback...`);
            const { data: allCats, categoryMap } = this.categoriesCache || {};
            if (allCats && categoryMap) {
                const target = allCats.find(c => c.slug.toLowerCase() === category.toLowerCase());
                if (target && target.parentId) {
                    const parent = categoryMap.get(target.parentId);
                    if (parent) {
                        console.log(`[getAllProducts] Falling back to parent category: ${parent.name}`);
                        const [fallbackData, fallbackTotal] = await Promise.all([
                            this.prisma.product.findMany({
                                where: {
                                    OR: [
                                        { internalCategoryId: parent.id },
                                        { category: { contains: parent.name, mode: 'insensitive' } }
                                    ]
                                },
                                skip,
                                take: l,
                                orderBy: { createdAt: 'desc' },
                                select: {
                                    id: true,
                                    name: true,
                                    price: true,
                                    imageUrl: true,
                                    awThumbUrl: true,
                                    largeImage: true,
                                    category: true,
                                    slug: true,
                                    merchant: true,
                                    productUrl: true,
                                    description: true,
                                    createdAt: true,
                                    colour: true,
                                    merchantCategory: true,
                                    productType: true,
                                    colorVariants: true,
                                    attributes: {
                                        select: {
                                            attribute: { select: { name: true } },
                                            attributeValue: { select: { value: true } }
                                        }
                                    }
                                },
                            }),
                            this.prisma.product.count({
                                where: {
                                    OR: [
                                        { internalCategoryId: parent.id },
                                        { category: { contains: parent.name, mode: 'insensitive' } }
                                    ]
                                }
                            }),
                        ]);
                        return { data: fallbackData, total: fallbackTotal, page: p, totalPages: Math.ceil(fallbackTotal / l) };
                    }
                }
            }
            const words = category.split(/[\s&>|]+/).filter(w => w.length > 2);
            if (words.length > 0) {
                const fallbackWhere = {
                    OR: words.flatMap(word => [
                        { category: { contains: word, mode: 'insensitive' } },
                        { merchantCategory: { contains: word, mode: 'insensitive' } },
                        { merchantProductCategoryPath: { contains: word, mode: 'insensitive' } }
                    ])
                };
                const [fallbackData, fallbackTotal] = await Promise.all([
                    this.prisma.product.findMany({
                        where: fallbackWhere,
                        skip,
                        take: l,
                        orderBy: { createdAt: 'desc' },
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            imageUrl: true,
                            awThumbUrl: true,
                            largeImage: true,
                            category: true,
                            slug: true,
                            merchant: true,
                            productUrl: true,
                            description: true,
                            createdAt: true,
                            colour: true,
                            merchantCategory: true,
                            productType: true,
                            colorVariants: true,
                            attributes: {
                                select: {
                                    attribute: { select: { name: true } },
                                    attributeValue: { select: { value: true } }
                                }
                            }
                        },
                    }),
                    this.prisma.product.count({ where: fallbackWhere }),
                ]);
                if (fallbackTotal > 0) {
                    data = fallbackData;
                    total = fallbackTotal;
                }
            }
        }
        const products = data.map((p) => {
            const img = p.imageUrl || p.largeImage || p.awThumbUrl || '';
            return {
                ...p,
                imageUrl: img,
                image: img,
                images: img ? [img] : [],
                colors: [
                    ...(p.colour ? [{ name: p.colour, hex: p.colour, imageUrl: img, productUrl: p.productUrl }] : []),
                    ...(p.colorVariants || []).map((v) => ({
                        name: v.colorName,
                        hex: v.colorName,
                        imageUrl: v.imageUrl,
                        productUrl: v.productUrl
                    }))
                ],
                normalizedAttributes: (p.attributes || []).reduce((acc, attr) => {
                    acc[attr.attribute.name] = attr.attributeValue.value;
                    return acc;
                }, {}),
            };
        });
        const result = {
            data: products,
            meta: {
                total,
                page: p,
                limit: l,
                totalPages: Math.ceil(total / l),
            },
        };
        if (this.productsCache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.productsCache.keys().next().value;
            if (oldestKey)
                this.productsCache.delete(oldestKey);
        }
        this.productsCache.set(cacheKey, { data: result, timestamp: now });
        if (Math.random() < 0.1) {
            for (const [key, value] of this.productsCache.entries()) {
                if (now - value.timestamp > this.CACHE_TTL) {
                    this.productsCache.delete(key);
                }
            }
        }
        return result;
    }
    async getMerchants() {
        const merchants = await this.prisma.product.findMany({
            distinct: ['merchant'],
            select: { merchant: true },
        });
        return merchants
            .map(m => m.merchant)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    }
    async getCategories() {
        const now = Date.now();
        if (!this.categoriesCache || now - this.categoriesCache.timestamp > this.CACHE_TTL) {
            const allCats = await this.categoryService.findAll();
            const categoryMap = new Map();
            const childrenMap = new Map();
            allCats.forEach(cat => {
                categoryMap.set(cat.id, cat);
                if (cat.parentId) {
                    const children = childrenMap.get(cat.parentId) || [];
                    children.push(cat);
                    childrenMap.set(cat.parentId, children);
                }
            });
            this.categoriesCache = { data: allCats, categoryMap, childrenMap, timestamp: now };
        }
        const { data: allCategories, categoryMap, childrenMap } = this.categoriesCache;
        const counts = await this.prisma.product.groupBy({
            by: ['internalCategoryId'],
            _count: { _all: true }
        });
        const countMap = {};
        counts.forEach(c => {
            if (c.internalCategoryId) {
                countMap[c.internalCategoryId] = c._count._all;
            }
        });
        const memo = new Map();
        const calculateAllCounts = () => {
            allCategories.forEach(cat => {
                memo.set(cat.id, countMap[cat.id] || 0);
            });
        };
        const getDeepCount = (catId, visited = new Set()) => {
            if (visited.has(catId))
                return 0;
            if (memo.has(catId))
                return memo.get(catId);
            visited.add(catId);
            const cat = categoryMap.get(catId);
            if (!cat)
                return 0;
            const children = childrenMap.get(catId) || [];
            let total = 0;
            if (children.length > 0) {
                children.forEach((child) => {
                    total += getDeepCount(child.id, visited);
                });
            }
            else {
                total = countMap[catId] || 0;
            }
            memo.set(catId, total);
            return total;
        };
        allCategories.forEach(cat => {
            if (!memo.has(cat.id)) {
                getDeepCount(cat.id);
            }
        });
        const buildHierarchy = (cat, visited = new Set()) => {
            if (visited.has(cat.id))
                return null;
            visited.add(cat.id);
            const children = childrenMap.get(cat.id) || [];
            return {
                ...cat,
                productCount: getDeepCount(cat.id),
                children: children
                    .map((child) => buildHierarchy(child, visited))
                    .filter(Boolean),
            };
        };
        const EXCLUDED_CATEGORIES = [
            'pet',
            'skin',
            'beauty',
            'health',
            'fragrance',
            'jewelry',
        ];
        const roots = allCategories.filter((c) => !c.parentId);
        const filteredRoots = roots
            .map((root) => {
            const name = (root.name || '').toLowerCase();
            if (EXCLUDED_CATEGORIES.some((ex) => name.includes(ex)))
                return null;
            if (!root.isAwin) {
                return buildHierarchy(root);
            }
            const totalCount = getDeepCount(root.id);
            if (totalCount > 0) {
                return buildHierarchy(root);
            }
            return null;
        })
            .filter(Boolean);
        return filteredRoots;
    }
    async getProductBySlug(slug) {
        const product = await this.prisma.product.findFirst({
            where: {
                slug: { equals: slug, mode: 'insensitive' }
            },
            include: {
                colorVariants: true,
                attributes: {
                    include: {
                        attribute: true,
                        attributeValue: true
                    }
                }
            }
        });
        return product;
    }
    async getProductById(id) {
        return this.prisma.product.findUnique({
            where: { id },
            include: {
                colorVariants: true,
                attributes: {
                    include: {
                        attribute: true,
                        attributeValue: true
                    }
                }
            }
        });
    }
    async updateProduct(id, updateProductDto) {
        return this.prisma.product.update({
            where: { id },
            data: updateProductDto,
        });
    }
    async deleteProduct(id) {
        const result = await this.prisma.product.delete({ where: { id } });
        this.productsCache.clear();
        return result;
    }
    async deleteProductsByMerchant(merchantName) {
        const result = await this.prisma.product.deleteMany({
            where: {
                merchant: { equals: merchantName, mode: 'insensitive' }
            }
        });
        this.productsCache.clear();
        return result;
    }
    async deduplicate() {
        const result = await this.awinService.deduplicateProducts();
        this.productsCache.clear();
        return result;
    }
};
exports.AwinController = AwinController;
__decorate([
    (0, common_1.Post)('add-product'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a new product using an Awin URL' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'The product has been successfully created.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "addProduct", null);
__decorate([
    (0, common_1.Post)('upload-csv'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a CSV file of products' }),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "uploadCsv", null);
__decorate([
    (0, common_1.Get)('import-status/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get the status of an import job' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getImportStatus", null);
__decorate([
    (0, common_1.Get)('products'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all saved products with pagination' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Return paginated products.' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('category')),
    __param(3, (0, common_1.Query)('subs')),
    __param(4, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getAllProducts", null);
__decorate([
    (0, common_1.Get)('merchants'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all unique merchants from products' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getMerchants", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all unique product categories with products' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('products/by-slug/:slug'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a product by slug' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Return the product.' }),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getProductBySlug", null);
__decorate([
    (0, common_1.Get)('products/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a product by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Return the product.' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getProductById", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a product' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'The product has been successfully updated.' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Delete)('products/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a product' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'The product has been successfully deleted.' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "deleteProduct", null);
__decorate([
    (0, common_1.Delete)('products/by-merchant/:merchantName'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete all products from a specific merchant (Hard Delete)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'All products from the merchant have been permanently removed.' }),
    __param(0, (0, common_1.Param)('merchantName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "deleteProductsByMerchant", null);
__decorate([
    (0, common_1.Post)('products/deduplicate'),
    (0, swagger_1.ApiOperation)({ summary: 'Run global product deduplication' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "deduplicate", null);
exports.AwinController = AwinController = __decorate([
    (0, swagger_1.ApiTags)('awin'),
    (0, common_1.Controller)('awin'),
    __metadata("design:paramtypes", [awin_service_1.AwinService,
        prisma_service_1.PrismaService,
        import_status_service_1.ImportStatusService,
        category_service_1.CategoryService])
], AwinController);
//# sourceMappingURL=awin.controller.js.map