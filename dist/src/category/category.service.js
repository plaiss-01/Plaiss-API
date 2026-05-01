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
    clearCache() {
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
                        },
                        include: { children: true, parent: true }
                    });
                }
                else {
                    if (category.isAwin && data.isAwin !== true) {
                        category = await this.prisma.category.update({
                            where: { id: category.id },
                            data: { isAwin: false },
                            include: { children: true, parent: true }
                        });
                    }
                }
                currentParentId = category.id;
                lastCreated = category;
            }
            return lastCreated;
        }
        try {
            const slug = this.slugify(data.name);
            const existing = await this.prisma.category.findFirst({
                where: {
                    OR: [
                        { slug },
                        { name: { equals: data.name, mode: 'insensitive' } }
                    ]
                }
            });
            if (existing) {
                const updateData = {};
                let needsUpdate = false;
                if (existing.isAwin && data.isAwin !== true) {
                    updateData.isAwin = false;
                    needsUpdate = true;
                }
                const requestedParentId = data.parentId || null;
                if (existing.parentId !== requestedParentId) {
                    updateData.parentId = requestedParentId;
                    needsUpdate = true;
                }
                if (needsUpdate) {
                    this.clearCache();
                    return await this.prisma.category.update({
                        where: { id: existing.id },
                        data: updateData,
                        include: { children: true, parent: true }
                    });
                }
                return existing;
            }
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
            throw error;
        }
    }
    async findAll(isAwin, search, limit = 1000, parentId) {
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
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
            take: limit,
        });
    }
    async findRoots() {
        return this.prisma.category.findMany({
            where: { parentId: null, isAwin: false },
            include: {
                children: {
                    include: {
                        children: true,
                        parent: true,
                    },
                },
                parent: true,
            },
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
        });
    }
    async reorder(orders) {
        this.clearCache();
        const updates = orders.map((item) => this.prisma.category.update({
            where: { id: item.id },
            data: { order: item.order },
        }));
        return Promise.all(updates);
    }
    async bulkLink(ids, parentId) {
        this.clearCache();
        const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
        if (!parent)
            throw new common_1.NotFoundException('Parent category not found');
        const mergedCats = await this.prisma.category.findMany({
            where: { id: { in: ids } },
            select: { name: true, isAwin: true }
        });
        const mergedNames = mergedCats.map(c => c.name);
        const awinNamesToMerge = mergedCats.filter(c => c.isAwin).map(c => c.name);
        const result = await this.prisma.category.updateMany({
            where: { id: { in: ids } },
            data: { parentId, isAwin: false },
        });
        if (!parent.isAwin && awinNamesToMerge.length > 0) {
            await this.prisma.product.updateMany({
                where: {
                    OR: [
                        { category: { in: awinNamesToMerge } },
                        { merchantCategory: { in: awinNamesToMerge } }
                    ]
                },
                data: { category: parent.name }
            });
        }
        return result;
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
        this.clearCache();
        try {
            console.log(`[CategoryService] Updating category ${id}`, data);
            const currentCategory = await this.prisma.category.findUnique({
                where: { id },
            });
            if (!currentCategory) {
                throw new common_1.NotFoundException(`Category with ID ${id} not found`);
            }
            if (data.isMerged !== undefined) {
                const boolVal = data.isMerged === true || data.isMerged === 'true';
                await this.prisma.category.update({
                    where: { id },
                    data: { isMerged: boolVal }
                });
            }
            if (data.name || data.parentId !== undefined) {
                const prismaUpdate = {};
                if (data.name && data.name !== currentCategory.name) {
                    const newName = data.name;
                    const newSlug = this.slugify(newName);
                    const existing = await this.prisma.category.findFirst({
                        where: {
                            OR: [{ name: newName }, { slug: newSlug }],
                            NOT: { id: id }
                        }
                    });
                    if (existing) {
                        console.log(`Merging category "${currentCategory.name}" into existing category "${existing.name}"`);
                        await this.prisma.category.updateMany({
                            where: { parentId: id },
                            data: { parentId: existing.id }
                        });
                        await this.prisma.product.updateMany({
                            where: {
                                OR: [
                                    { category: currentCategory.name },
                                    { merchantCategory: currentCategory.name }
                                ]
                            },
                            data: { category: existing.name }
                        });
                        await this.prisma.category.delete({
                            where: { id }
                        });
                        if (existing.isAwin) {
                            await this.prisma.category.update({
                                where: { id: existing.id },
                                data: { isAwin: false }
                            });
                        }
                        return { id: existing.id, merged: true, success: true };
                    }
                    prismaUpdate.name = newName;
                    prismaUpdate.slug = newSlug;
                    prismaUpdate.isAwin = false;
                }
                if (data.parentId !== undefined) {
                    prismaUpdate.parentId = data.parentId;
                }
                if (Object.keys(prismaUpdate).length > 0) {
                    await this.prisma.category.update({
                        where: { id },
                        data: prismaUpdate,
                    });
                }
            }
            return { id, success: true };
        }
        catch (error) {
            if (error.code === 'P2002') {
                throw new common_1.ConflictException('A category with this name or slug already exists');
            }
            console.error('Category update error:', error);
            throw error;
        }
    }
    async remove(id) {
        this.clearCache();
        return this.prisma.category.delete({
            where: { id }
        });
    }
    async removeAll() {
        this.clearCache();
        return this.prisma.category.deleteMany({});
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
                    data: { name, slug, isAwin: true },
                });
                created.push(cat);
            }
            else {
                const updateData = {};
                let needsUpdate = false;
                if (!existing.slug) {
                    updateData.slug = slug;
                    needsUpdate = true;
                }
                if (needsUpdate) {
                    await this.prisma.category.update({
                        where: { id: existing.id },
                        data: updateData,
                    });
                }
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