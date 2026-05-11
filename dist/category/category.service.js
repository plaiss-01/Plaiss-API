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
var CategoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let CategoryService = class CategoryService {
    static { CategoryService_1 = this; }
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    static categoriesCache = null;
    CACHE_TTL = 30000;
    async getCategoryStructure() {
        const now = Date.now();
        if (!CategoryService_1.categoriesCache || now - CategoryService_1.categoriesCache.timestamp > this.CACHE_TTL) {
            const allCats = await this.findAll();
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
            CategoryService_1.categoriesCache = { data: allCats, categoryMap, childrenMap, timestamp: now };
        }
        return CategoryService_1.categoriesCache;
    }
    clearCache() {
        CategoryService_1.categoriesCache = null;
    }
    slugify(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    async create(data) {
        const slug = this.slugify(data.name);
        const existing = await this.prisma.category.findUnique({
            where: { name: data.name },
        });
        if (existing) {
            throw new common_1.ConflictException(`Category with name "${data.name}" already exists.`);
        }
        return this.prisma.category.create({
            data: {
                name: data.name,
                slug,
                isAwin: data.isAwin !== undefined ? data.isAwin : false,
                parentId: data.parentId || null,
            },
            include: {
                children: true,
                parent: true,
            },
        });
    }
    async findAll(isAwin, search, limit = 100000, parentId) {
        const where = {};
        if (isAwin !== undefined) {
            where.isAwin = isAwin;
        }
        if (parentId !== undefined) {
            where.parentId = parentId === 'null' ? null : parentId;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
            ];
        }
        return this.prisma.category.findMany({
            where,
            include: {
                children: true,
                parent: true,
            },
            take: limit > 0 ? limit : undefined,
        });
    }
    async findRoots() {
        return this.findAll(false);
    }
    async reorder(orders) {
        return [];
    }
    async bulkLink(ids, parentId) {
        return { count: 0 };
    }
    async findOne(id) {
        const cat = await this.prisma.category.findUnique({
            where: { id },
            include: {
                children: true,
                parent: true,
            },
        });
        if (!cat)
            throw new common_1.NotFoundException('Category not found');
        return cat;
    }
    async findBySlug(slug) {
        const cat = await this.prisma.category.findUnique({
            where: { slug },
            include: {
                children: true,
                parent: true,
            },
        });
        if (!cat)
            throw new common_1.NotFoundException('Category not found');
        return cat;
    }
    async update(id, data) {
        const updateData = {};
        if (data.name) {
            updateData.name = data.name;
            updateData.slug = this.slugify(data.name);
            await this.prisma.product.updateMany({
                where: { category: { equals: id, mode: 'insensitive' } },
                data: { category: data.name },
            });
        }
        if (data.parentId !== undefined) {
            updateData.parentId = data.parentId === 'null' ? null : data.parentId;
        }
        if (Object.keys(updateData).length === 0) {
            return { id, success: true, message: 'No changes made' };
        }
        const updated = await this.prisma.category.update({
            where: { id },
            data: updateData,
        });
        this.clearCache();
        return { ...updated, success: true };
    }
    async remove(id) {
        await this.prisma.category.updateMany({
            where: { parentId: id },
            data: { parentId: null },
        });
        const deleted = await this.prisma.category.delete({
            where: { id },
        });
        this.clearCache();
        return deleted;
    }
    async removeAll() {
        this.clearCache();
        return { count: 0 };
    }
    async syncAwinCategories() {
        const products = await this.prisma.product.findMany({
            where: { category: { not: null } },
            select: { category: true },
            distinct: ['category'],
        });
        this.clearCache();
        return {
            message: `Found ${products.length} unique categories in products`,
            newlyCreated: 0,
        };
    }
};
exports.CategoryService = CategoryService;
exports.CategoryService = CategoryService = CategoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoryService);
//# sourceMappingURL=category.service.js.map