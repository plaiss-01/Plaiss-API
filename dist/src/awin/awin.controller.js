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
let AwinController = class AwinController {
    awinService;
    prisma;
    statusService;
    constructor(awinService, prisma, statusService) {
        this.awinService = awinService;
        this.prisma = prisma;
        this.statusService = statusService;
    }
    categoriesCache = null;
    CATEGORY_CACHE_TTL = 60000;
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
    async getAllProducts(page = '1', limit = '5000', category) {
        const p = parseInt(page, 10) || 1;
        const l = parseInt(limit, 10) || 5000;
        const skip = (p - 1) * l;
        const where = {};
        if (category && category !== 'all-products') {
            const currentCat = await this.prisma.category.findFirst({
                where: {
                    OR: [
                        { name: { equals: category, mode: 'insensitive' } },
                        { slug: { equals: category, mode: 'insensitive' } }
                    ]
                },
                include: { children: true }
            });
            const ROOM_MAPPINGS = {
                'Living Room': ['Tables', 'Chairs', 'Storage', 'Decorations', 'Lighting'],
                'Bedroom': ['Beds', 'Mattresses', 'Storage'],
                'Kitchen': ['Kitchen Units', 'Cookware & Utensils'],
                'Outdoor': ['Sheds & Garden Furniture', 'Plants & Seeds'],
                'Garden & Outdoor': ['Sheds & Garden Furniture', 'Plants & Seeds'],
                'Kitchen & Dining': ['Kitchen Units', 'Tables', 'Chairs'],
            };
            if (ROOM_MAPPINGS[category]) {
                where.OR = ROOM_MAPPINGS[category].map(name => ({
                    category: { contains: name, mode: 'insensitive' }
                }));
            }
            else {
                const currentCat = await this.prisma.category.findFirst({
                    where: {
                        OR: [
                            { name: { equals: category, mode: 'insensitive' } },
                            { slug: { equals: category, mode: 'insensitive' } }
                        ]
                    },
                });
                if (currentCat) {
                    let allCats;
                    const now = Date.now();
                    if (this.categoriesCache && (now - this.categoriesCache.timestamp < this.CATEGORY_CACHE_TTL)) {
                        allCats = this.categoriesCache.data;
                    }
                    else {
                        allCats = await this.prisma.category.findMany();
                        this.categoriesCache = { data: allCats, timestamp: now };
                    }
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
                    const getDescendantNames = (catId, visited = new Set()) => {
                        if (visited.has(catId))
                            return [];
                        visited.add(catId);
                        const cat = categoryMap.get(catId);
                        if (!cat)
                            return [];
                        const names = [cat.name];
                        const children = childrenMap.get(catId) || [];
                        return names.concat(...children.map(child => getDescendantNames(child.id, visited)));
                    };
                    const categoryNames = getDescendantNames(currentCat.id);
                    where.OR = categoryNames.map(name => ({
                        category: {
                            contains: name,
                            mode: 'insensitive'
                        }
                    }));
                }
                else {
                    where.category = {
                        contains: category,
                        mode: 'insensitive',
                    };
                }
            }
        }
        const [data, total] = await Promise.all([
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
                    category: true,
                    slug: true,
                    merchant: true,
                    productUrl: true,
                    description: true,
                    createdAt: true,
                },
            }),
            this.prisma.product.count({ where }),
        ]);
        return {
            data,
            meta: {
                total,
                page: p,
                limit: l,
                totalPages: Math.ceil(total / l),
            },
        };
    }
    async getCategories() {
        const allCategories = await this.prisma.category.findMany({
            orderBy: { name: 'asc' }
        });
        const categoryMap = new Map();
        const childrenMap = new Map();
        allCategories.forEach(cat => {
            categoryMap.set(cat.id, cat);
            if (cat.parentId) {
                const children = childrenMap.get(cat.parentId) || [];
                children.push(cat);
                childrenMap.set(cat.parentId, children);
            }
        });
        const counts = await this.prisma.product.groupBy({
            by: ['category'],
            _count: { _all: true }
        });
        const countMap = {};
        counts.forEach(c => {
            if (c.category) {
                countMap[c.category.toLowerCase().trim()] = c._count._all;
            }
        });
        const memo = new Map();
        const getDeepCount = (catId, visited = new Set()) => {
            if (visited.has(catId))
                return 0;
            if (memo.has(catId))
                return memo.get(catId);
            visited.add(catId);
            const cat = categoryMap.get(catId);
            if (!cat)
                return 0;
            let total = countMap[cat.name.toLowerCase().trim()] || 0;
            const children = childrenMap.get(catId) || [];
            children.forEach((child) => {
                total += getDeepCount(child.id, visited);
            });
            memo.set(catId, total);
            return total;
        };
        const roots = allCategories.filter((c) => !c.parentId);
        const EXCLUDED_CATEGORIES = ['pet', 'skin', 'beauty', 'health', 'fragrance', 'jewelry'];
        const filteredRoots = roots.map((root) => {
            const name = (root.name || '').toLowerCase();
            if (EXCLUDED_CATEGORIES.some(ex => name.includes(ex)))
                return null;
            const totalCount = getDeepCount(root.id);
            if (totalCount > 0) {
                const children = childrenMap.get(root.id) || [];
                return {
                    ...root,
                    productCount: totalCount,
                    children: children.map(child => ({
                        ...child,
                        productCount: getDeepCount(child.id)
                    })).filter(c => c.productCount > 0)
                };
            }
            return null;
        }).filter(Boolean);
        return filteredRoots;
    }
    async getProductBySlug(slug) {
        console.log(`[AwinController] Fetching product by slug: ${slug}`);
        const product = await this.prisma.product.findFirst({
            where: {
                slug: { equals: slug, mode: 'insensitive' }
            }
        });
        console.log(`[AwinController] Found product: ${product ? product.name : 'NULL'}`);
        return product;
    }
    async getProductById(id) {
        return this.prisma.product.findUnique({ where: { id } });
    }
    async updateProduct(id, updateProductDto) {
        return this.prisma.product.update({
            where: { id },
            data: updateProductDto,
        });
    }
    async deleteProduct(id) {
        return this.prisma.product.delete({ where: { id } });
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getAllProducts", null);
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
exports.AwinController = AwinController = __decorate([
    (0, swagger_1.ApiTags)('awin'),
    (0, common_1.Controller)('awin'),
    __metadata("design:paramtypes", [awin_service_1.AwinService,
        prisma_service_1.PrismaService,
        import_status_service_1.ImportStatusService])
], AwinController);
//# sourceMappingURL=awin.controller.js.map