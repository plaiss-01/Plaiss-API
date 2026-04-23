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
    async create(data) {
        try {
            return await this.prisma.category.create({
                data,
                include: { children: true, parent: true },
            });
        }
        catch (error) {
            if (error.code === 'P2002') {
                throw new common_1.ConflictException('Category with this name already exists');
            }
            throw error;
        }
    }
    async findAll() {
        return this.prisma.category.findMany({
            include: {
                children: true,
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
    async update(id, data) {
        return this.prisma.category.update({
            where: { id },
            data,
            include: { children: true, parent: true },
        });
    }
    async remove(id) {
        return this.prisma.category.delete({ where: { id } });
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
            const existing = await this.prisma.category.findUnique({
                where: { name },
            });
            if (!existing) {
                const cat = await this.prisma.category.create({
                    data: { name, isAwin: true },
                });
                created.push(cat);
            }
            else if (!existing.isAwin) {
                await this.prisma.category.update({
                    where: { id: existing.id },
                    data: { isAwin: true },
                });
            }
        }
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