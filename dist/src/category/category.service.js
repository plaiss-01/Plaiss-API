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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let CategoryService = class CategoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    categoriesCache = null;
    CACHE_TTL = 60000;
    clearCache() {
        this.categoriesCache = null;
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
        const rawName = data.name;
        const parts = rawName.split(/\s*[>|]\s*|\s*&gt;\s*/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
            let currentParentId = data.parentId || null;
            let lastCreated = null;
            for (const part of parts) {
                const slug = this.slugify(part);
                let category = await this.prisma.category.findFirst({
                    where: { OR: [{ slug }, { name: { equals: part, mode: 'insensitive' } }] }
                });
                if (!category) {
                    category = await this.prisma.category.create({
                        data: {
                            name: part,
                            slug,
                            parentId: currentParentId,
                            isAwin: data.isAwin || false,
                            isDeleted: false,
                        },
                        include: { children: true, parent: true }
                    });
                }
                else if (category.isDeleted) {
                }
                currentParentId = category.id;
                lastCreated = category;
            }
            return lastCreated;
        }
        try {
            const slug = this.slugify(data.name);
            const createData = {
                name: data.name,
                slug,
                isAwin: data.isAwin || false,
            };
            if (data.parentId && data.parentId !== '') {
                createData.parentId = data.parentId;
            }
            this.clearCache();
            return await this.prisma.category.create({
                data: createData,
                include: { children: true, parent: true },
            });
        }
        catch (error) {
            if (error.code === 'P2002') {
                throw new common_1.ConflictException('Category with this name or slug already exists');
            }
            throw error;
        }
    }
    async findAll(includeDeleted = false) {
        const now = Date.now();
        if (!includeDeleted && this.categoriesCache && (now - this.categoriesCache.timestamp < this.CACHE_TTL)) {
            return this.categoriesCache.data;
        }
        const where = {};
        if (!includeDeleted) {
            where.isDeleted = false;
        }
        const data = await this.prisma.category.findMany({
            where,
            include: {
                children: {
                    where: includeDeleted ? {} : { isDeleted: false }
                },
                parent: true,
            },
            orderBy: { name: 'asc' },
        });
        if (!includeDeleted) {
            this.categoriesCache = { data, timestamp: now };
        }
        return data;
    }
    async findRoots() {
        return this.prisma.category.findMany({
            where: { parentId: null, isDeleted: false },
            include: {
                children: {
                    where: { isDeleted: false },
                    include: {
                        children: {
                            where: { isDeleted: false }
                        },
                        parent: true,
                    },
                },
                parent: true,
            },
            orderBy: { name: 'asc' },
        });
    }
    async findOne(id) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            include: { children: true, parent: true },
        });
        if (!category)
            throw new common_1.NotFoundException('Category not found');
        return category;
    }
    async findBySlug(slug) {
        const category = await this.prisma.category.findUnique({
            where: { slug },
            include: { children: true, parent: true },
        });
        if (!category)
            throw new common_1.NotFoundException('Category not found');
        return category;
    }
    async update(id, data) {
        const updateData = { ...data };
        if (data.name) {
            updateData.slug = this.slugify(data.name);
        }
        this.clearCache();
        return this.prisma.category.update({
            where: { id },
            data: updateData,
            include: { children: true, parent: true },
        });
    }
    async remove(id) {
        this.clearCache();
        return this.prisma.category.update({
            where: { id },
            data: { isDeleted: true }
        });
    }
    async restore(id) {
        this.clearCache();
        return this.prisma.category.update({
            where: { id },
            data: { isDeleted: false }
        });
    }
    async syncAwinCategories() {
        const products = await this.prisma.product.findMany({
            where: { category: { not: null } },
            select: { category: true },
            distinct: ['category'],
        });
        const awinCategoryNames = products
            .map((p) => p.category?.trim())
            .filter((name) => !!name && name !== '');
        const created = [];
        for (const name of awinCategoryNames) {
            const slug = this.slugify(name);
            const existing = await this.prisma.category.findFirst({
                where: { OR: [{ name }, { slug }] },
            });
            if (!existing) {
                const cat = await this.prisma.category.create({
                    data: { name, slug, isAwin: true, isDeleted: false },
                });
                created.push(cat);
            }
            else if (!existing.isDeleted) {
                const updateData = { isAwin: true };
                if (!existing.slug) {
                    updateData.slug = slug;
                }
                await this.prisma.category.update({
                    where: { id: existing.id },
                    data: updateData,
                });
            }
        }
        this.clearCache();
        return {
            message: `Synced ${awinCategoryNames.length} categories from Awin`,
            newlyCreated: created.length,
        };
    }
};
exports.CategoryService = CategoryService;
exports.CategoryService = CategoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoryService);
//# sourceMappingURL=category.service.js.map