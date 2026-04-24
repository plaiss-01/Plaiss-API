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
const swagger_1 = require("@nestjs/swagger");
const awin_service_1 = require("./awin.service");
const prisma_service_1 = require("../prisma.service");
const create_product_dto_1 = require("./dto/create-product.dto");
const update_product_dto_1 = require("./dto/update-product.dto");
let AwinController = class AwinController {
    awinService;
    prisma;
    constructor(awinService, prisma) {
        this.awinService = awinService;
        this.prisma = prisma;
    }
    async addProduct(createProductDto) {
        return this.awinService.addProductFromUrl(createProductDto.url);
    }
    async getAllProducts(page = '1', limit = '10', category) {
        const p = parseInt(page, 10) || 1;
        const l = parseInt(limit, 10) || 10;
        const skip = (p - 1) * l;
        const where = {};
        if (category && category !== 'all-products') {
            where.category = {
                contains: category,
                mode: 'insensitive',
            };
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
                    merchant: true,
                    productUrl: true,
                    description: true,
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
        const categories = await this.prisma.product.groupBy({
            by: ['category'],
        });
        const uniqueSlugs = new Set(categories
            .map(c => c.category?.toLowerCase().trim())
            .filter(Boolean));
        return Array.from(uniqueSlugs).map(slug => ({
            slug,
        }));
    }
    async getProductBySlug(slug) {
        const all = await this.prisma.product.findMany();
        return all.find(p => {
            const pSlug = p.name
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            return pSlug === slug.toLowerCase();
        });
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
    (0, swagger_1.ApiOperation)({ summary: 'Get all unique product categories' }),
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
        prisma_service_1.PrismaService])
], AwinController);
//# sourceMappingURL=awin.controller.js.map