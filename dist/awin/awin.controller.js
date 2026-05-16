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
var AwinController_1;
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
let AwinController = AwinController_1 = class AwinController {
    awinService;
    prisma;
    statusService;
    categoryService;
    logger = new common_1.Logger(AwinController_1.name);
    constructor(awinService, prisma, statusService, categoryService) {
        this.awinService = awinService;
        this.prisma = prisma;
        this.statusService = statusService;
        this.categoryService = categoryService;
    }
    productsCache = new Map();
    CACHE_TTL = 30000;
    MAX_CACHE_SIZE = 20;
    productListSelect = {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        currency: true,
        imageUrl: true,
        productUrl: true,
        merchant: true,
        category: true,
        merchantProductId: true,
        merchantCategory: true,
        categoryId: true,
        brandName: true,
        colour: true,
        productModel: true,
        productType: true,
        createdAt: true,
        rawRow: true,
        productModelClean: true,
        colourClean: true,
        sizeStockStatusClean: true,
        isRecliner: true,
        isSofaBed: true,
        baseSku: true,
        colourVariantNumber: true,
        originalPriceClean: true,
        discountedPriceClean: true,
        saving: true,
        colorVariants: {
            select: {
                id: true,
                colorName: true,
                imageUrl: true,
                productUrl: true,
                awinId: true,
            }
        },
    };
    isUsableImageValue(value) {
        if (!value)
            return false;
        const trimmed = value.trim();
        return !!trimmed && !/^(?:n\/?a|na|none|null|undefined|no\s+image(?:\s+available)?|image\s+(?:not\s+)?available|not\s+available|missing|-+)$/i.test(trimmed);
    }
    decodeProductServeSource(value) {
        if (!value)
            return '';
        let decoded = value.trim();
        for (let i = 0; i < 2; i += 1) {
            try {
                const next = decodeURIComponent(decoded);
                if (next === decoded)
                    break;
                decoded = next;
            }
            catch {
                break;
            }
        }
        if (/^ssl:/i.test(decoded)) {
            return `https://${decoded.replace(/^ssl:\/?/i, '').replace(/^\/+/, '')}`;
        }
        if (/^https?:\/\//i.test(decoded)) {
            return decoded.replace(/^http:\/\//i, 'https://');
        }
        if (/^\/\//.test(decoded)) {
            return `https:${decoded}`;
        }
        if (/^[a-z0-9.-]+\//i.test(decoded)) {
            return `https://${decoded}`;
        }
        return '';
    }
    normalizeProductImageUrl(value, size = 900) {
        if (!this.isUsableImageValue(value))
            return '';
        const secureValue = value.trim().replace(/^http:\/\//i, 'https://');
        try {
            const parsed = new URL(secureValue);
            if (parsed.hostname.includes('productserve.com')) {
                const directSource = this.decodeProductServeSource(parsed.searchParams.get('url'));
                if (directSource)
                    return directSource;
                parsed.searchParams.set('w', String(size));
                parsed.searchParams.set('h', String(size));
                if (!parsed.searchParams.has('bg'))
                    parsed.searchParams.set('bg', 'white');
                if (!parsed.searchParams.has('t'))
                    parsed.searchParams.set('t', 'letterbox');
                return parsed.toString();
            }
            return secureValue;
        }
        catch {
            return secureValue;
        }
    }
    getBestProductImage(product) {
        let rawData = {};
        if (product.rawRow) {
            try {
                rawData = typeof product.rawRow === 'string' ? JSON.parse(product.rawRow) : product.rawRow;
            }
            catch (e) {
            }
        }
        const candidates = [
            product?.largeImage,
            product?.imageUrl,
            rawData.alternate_image,
            rawData.alternate_image_two,
            rawData.alternate_image_three,
            rawData.alternate_image_four,
            product?.alternateImage,
            rawData.merchant_image_url,
            rawData.merchant_thumb_url,
            product?.merchantThumbUrl,
            product?.awThumbUrl,
        ];
        for (const candidate of candidates) {
            const image = this.normalizeProductImageUrl(candidate);
            if (image && !image.includes('noimage.gif'))
                return image;
        }
        return candidates[0] || '';
    }
    enhanceProductImages(product) {
        if (!product)
            return product;
        const img = this.getBestProductImage(product);
        return {
            ...product,
            imageUrl: img,
            image: img,
            images: img ? [img] : [],
            colorVariants: product.colorVariants || [],
            colors: product.colour ? [{ name: product.colour, hex: product.colour, imageUrl: img, productUrl: product.productUrl }] : [],
            normalizedAttributes: {},
        };
    }
    async getPipelineTables() {
        return this.awinService.getAwinPipelineTableSummary();
    }
    async extractRaw(body) {
        if (!body || !body.url) {
            throw new common_1.BadRequestException('URL is required');
        }
        const jobId = `awin-raw-${Date.now()}`;
        this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting AWIN RAW extraction...');
        this.awinService.extractAwinFeedToRaw(body.url, jobId, body.replace !== false).catch((e) => {
            this.statusService.failJob(jobId, e.message);
        });
        return {
            jobId,
            message: 'AWIN RAW extraction started',
            table: this.awinService.getAwinPipelineTableNames().raw,
        };
    }
    async uploadRawCsv(file, body) {
        if (!file) {
            throw new common_1.BadRequestException('File is required');
        }
        const jobId = `awin-raw-csv-${Date.now()}`;
        this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting AWIN CSV RAW extraction...');
        this.awinService.extractCsvFileToRaw(file.buffer, jobId, body.replace !== 'false').catch((e) => {
            this.statusService.failJob(jobId, e.message);
        });
        return {
            jobId,
            message: 'AWIN CSV RAW extraction started',
            table: this.awinService.getAwinPipelineTableNames().raw,
        };
    }
    async transformDev(body) {
        const jobId = `awin-transform-dev-${Date.now()}`;
        this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting AWIN DEV transform...');
        this.awinService.transformRawToDev(body?.replace !== false, jobId).catch((e) => {
            this.statusService.failJob(jobId, e.message);
        });
        return {
            jobId,
            message: 'AWIN DEV transform started',
            sourceTable: this.awinService.getAwinPipelineTableNames().raw,
            targetTable: this.awinService.getAwinPipelineTableNames().dev,
        };
    }
    async promoteProd(body) {
        const jobId = `awin-promote-prod-${Date.now()}`;
        this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting AWIN PROD promotion...');
        this.awinService
            .loadDevToProd(body?.replace !== false, body?.syncProductTable !== false, jobId)
            .then(() => this.productsCache.clear())
            .catch((e) => {
            this.statusService.failJob(jobId, e.message);
        });
        this.productsCache.clear();
        return {
            jobId,
            message: 'AWIN PROD promotion started',
            sourceTable: this.awinService.getAwinPipelineTableNames().dev,
            targetTable: this.awinService.getAwinPipelineTableNames().prod,
        };
    }
    async addProduct(createProductDto) {
        return this.awinService.addProductFromUrl(createProductDto.url);
    }
    async uploadCsv(file) {
        if (!file) {
            throw new common_1.BadRequestException('File is required');
        }
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
    async getMixBrandsProducts(categories, limit = '50') {
        const categoryNames = categories.split(',').map(c => c.trim()).filter(Boolean);
        const l = parseInt(limit, 10) || 50;
        const where = {
            category: { in: categoryNames, mode: 'insensitive' },
            AND: [
                { brandName: { not: null } },
                { brandName: { not: '' } },
            ]
        };
        const products = await this.prisma.product.findMany({
            where,
            take: l,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
                brandName: true,
                category: true,
                merchant: true,
            }
        });
        return products.map((product) => this.enhanceProductImages(product));
    }
    async getFacets(category, subs) {
        let allCategoryNames = [];
        if (category)
            allCategoryNames.push(category);
        if (subs)
            allCategoryNames = allCategoryNames.concat(subs.split(','));
        if (allCategoryNames.length === 0) {
            return { sizes: [], colors: [], materials: [], priceMin: 0, priceMax: 0 };
        }
        const where = {
            OR: allCategoryNames.map(name => ({
                category: { contains: name, mode: 'insensitive' }
            }))
        };
        const [sizes, colors, materials] = await Promise.all([
            this.prisma.product.findMany({
                where,
                distinct: ['sizeStockStatusClean'],
                select: { sizeStockStatusClean: true },
            }),
            this.prisma.product.findMany({
                where,
                distinct: ['colourClean'],
                select: { colourClean: true },
            }),
            this.prisma.product.findMany({
                where,
                distinct: ['productModelClean'],
                select: { productModelClean: true },
            }),
        ]);
        const priceAgg = await this.prisma.product.aggregate({
            where,
            _min: { discountedPriceClean: true },
            _max: { discountedPriceClean: true },
        });
        const prices = [priceAgg._min.discountedPriceClean, priceAgg._max.discountedPriceClean].filter(Boolean);
        return {
            sizes: sizes.map((s) => s.sizeStockStatusClean).filter(Boolean),
            colors: colors.map((c) => c.colourClean).filter(Boolean),
            materials: materials.map((m) => m.productModelClean).filter(Boolean),
            priceMin: prices.length ? Math.min(...prices) : 0,
            priceMax: prices.length ? Math.max(...prices) : 0,
        };
    }
    async getAllProducts(page = '1', limit = '50', category, subs, search, colors, sizes, materials, merchants, types, minPrice, maxPrice) {
        const p = parseInt(page, 10) || 1;
        let l = parseInt(limit, 10) || 50;
        if (l > 1000)
            l = 1000;
        const skip = (p - 1) * l;
        const cacheKey = `products-${p}-${l}-${category || 'all'}-${subs || 'none'}-${search || 'none'}-${colors || 'none'}-${sizes || 'none'}-${materials || 'none'}-${merchants || 'none'}-${types || 'none'}-${minPrice || 'none'}-${maxPrice || 'none'}`;
        const now = Date.now();
        if (this.productsCache.has(cacheKey)) {
            const cached = this.productsCache.get(cacheKey);
            if (now - cached.timestamp < this.CACHE_TTL) {
                return cached.data;
            }
        }
        const where = {
            imageUrl: { not: null },
            NOT: { imageUrl: '' },
        };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { merchant: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
            ];
        }
        else if (category && category !== 'all-products') {
            const { data: allCats, categoryMap, childrenMap } = await this.categoryService.getCategoryStructure();
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
            if (category && !uniqueNames.some(n => n.toLowerCase() === category.toLowerCase())) {
                uniqueNames.push(category);
            }
            console.log(`[getAllProducts] Query: "${category}", IDs: ${uniqueIds.length}, Names: ${uniqueNames.length}`);
            where.OR = [
                { categoryId: { in: uniqueIds } },
                {
                    OR: uniqueNames.map((name) => ({
                        category: { contains: name, mode: 'insensitive' },
                    })),
                },
                {
                    OR: uniqueNames.map((name) => ({
                        merchantCategory: { contains: name, mode: 'insensitive' },
                    })),
                },
            ];
        }
        const hasFilters = colors || sizes || materials || merchants || types || minPrice || maxPrice;
        if (hasFilters) {
            const andConditions = [];
            if (colors) {
                const array = colors.replace(/\+/g, ' ').split(',').map(s => s.trim());
                andConditions.push({ OR: array.map(val => ({ colour: { equals: val, mode: 'insensitive' } })) });
            }
            if (sizes) {
                const array = sizes.replace(/\+/g, ' ').split(',').map(s => s.trim());
                andConditions.push({ OR: array.map(val => ({ sizeStockStatusClean: { contains: val, mode: 'insensitive' } })) });
            }
            if (materials) {
                const array = materials.replace(/\+/g, ' ').split(',').map(s => s.trim());
                andConditions.push({ OR: array.map(val => ({ productModelClean: { contains: val, mode: 'insensitive' } })) });
            }
            if (merchants) {
                const array = merchants.replace(/\+/g, ' ').split(',').map(s => s.trim());
                andConditions.push({ OR: array.map(val => ({ merchant: { equals: val, mode: 'insensitive' } })) });
            }
            if (types) {
                const array = types.replace(/\+/g, ' ').split(',').map(s => s.trim());
                andConditions.push({
                    OR: array.flatMap(val => [
                        { productType: { contains: val, mode: 'insensitive' } },
                        { category: { contains: val, mode: 'insensitive' } }
                    ])
                });
            }
            if (minPrice || maxPrice) {
                const priceCond = {};
                if (minPrice)
                    priceCond.gte = parseFloat(minPrice);
                if (maxPrice)
                    priceCond.lte = parseFloat(maxPrice);
                andConditions.push({ price: priceCond });
            }
            if (andConditions.length > 0) {
                where.AND = andConditions;
            }
        }
        let [idResults, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                select: { id: true, merchant: true },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.product.count({ where }),
        ]);
        this.logger.log(`[getAllProducts] page: ${p}, limit: ${l}, category: ${category}, search: ${search}`);
        this.logger.log(`[getAllProducts] where: ${JSON.stringify(where)}`);
        this.logger.log(`[getAllProducts] idResults: ${idResults.length}, total: ${total}`);
        let data = [];
        if (idResults.length > 0) {
            const groups = new Map();
            idResults.forEach((prod) => {
                const merchant = prod.merchant || 'Unknown';
                const list = groups.get(merchant) || [];
                list.push(prod.id);
                groups.set(merchant, list);
            });
            const interleavedIds = [];
            const maxLen = Math.max(...Array.from(groups.values()).map(a => a.length), 0);
            for (let i = 0; i < maxLen; i++) {
                for (const [merchant, ids] of groups.entries()) {
                    if (i < ids.length) {
                        interleavedIds.push(ids[i]);
                    }
                }
            }
            const skip = (p - 1) * l;
            const pageIds = interleavedIds.slice(skip, skip + l);
            if (pageIds.length === 0 && total > skip) {
                this.logger.warn(`[getAllProducts] pageIds is empty but total is ${total} and skip is ${skip}. Falling back to standard pagination.`);
                const fetchedProducts = await this.prisma.product.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: l,
                    select: this.productListSelect,
                });
                data = fetchedProducts;
            }
            else {
                const fetchedProducts = await this.prisma.product.findMany({
                    where: { id: { in: pageIds } },
                    select: this.productListSelect,
                });
                data = pageIds.map(id => fetchedProducts.find((prod) => prod.id === id)).filter(Boolean);
            }
        }
        if (total === 0 && category && category !== 'all-products' && !hasFilters) {
            console.log(`[getAllProducts] No products found for "${category}". Trying parent fallback...`);
            const { data: allCats, categoryMap } = await this.categoryService.getCategoryStructure();
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
                                        { category: { contains: parent.name, mode: 'insensitive' } }
                                    ]
                                },
                                skip,
                                take: l,
                                orderBy: { createdAt: 'desc' },
                                select: this.productListSelect,
                            }),
                            this.prisma.product.count({
                                where: {
                                    category: { contains: parent.name, mode: 'insensitive' }
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
                        { merchantCategory: { contains: word, mode: 'insensitive' } }
                    ])
                };
                const [fallbackData, fallbackTotal] = await Promise.all([
                    this.prisma.product.findMany({
                        where: fallbackWhere,
                        skip,
                        take: l,
                        orderBy: { createdAt: 'desc' },
                        select: this.productListSelect,
                    }),
                    this.prisma.product.count({ where: fallbackWhere }),
                ]);
                if (fallbackTotal > 0) {
                    data = fallbackData;
                    total = fallbackTotal;
                }
            }
        }
        const products = data.map((p) => this.enhanceProductImages(p));
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
    async getBrands(category) {
        const where = {};
        if (category && category !== 'all-products') {
            where.category = { equals: category, mode: 'insensitive' };
        }
        const brands = await this.prisma.product.findMany({
            where,
            distinct: ['merchant'],
            select: { merchant: true },
        });
        return brands
            .map(b => b.merchant)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    }
    async getCategories() {
        const { data: allCategories, categoryMap, childrenMap } = await this.categoryService.getCategoryStructure();
        const counts = await this.prisma.product.groupBy({
            by: ['category'],
            _count: { _all: true }
        });
        const countMap = {};
        counts.forEach(c => {
            if (c.category) {
                countMap[c.category] = c._count._all;
            }
        });
        const memo = new Map();
        const calculateAllCounts = () => {
            allCategories.forEach(cat => {
                memo.set(cat.id, countMap[cat.name] || 0);
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
        const idMatch = slug.match(/-(\d+)$/);
        const productId = idMatch ? idMatch[1] : null;
        const product = await this.prisma.product.findFirst({
            where: {
                OR: [
                    { slug: { equals: slug, mode: 'insensitive' } },
                    productId ? { id: productId } : undefined,
                ].filter(Boolean)
            },
            select: this.productListSelect,
        });
        return this.enhanceProductImages(product);
    }
    async getProductById(id) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            select: this.productListSelect,
        });
        return this.enhanceProductImages(product);
    }
    async updateProduct(id, updateProductDto) {
        return this.prisma.product.update({
            where: { id },
            data: updateProductDto,
        });
    }
    async deleteProduct(id) {
        await this.prisma.productColorVariant.deleteMany({ where: { productId: id } });
        const result = await this.prisma.product.delete({ where: { id } });
        this.productsCache.clear();
        return result;
    }
    async deleteProductsByMerchant(merchantName) {
        const products = await this.prisma.product.findMany({
            where: { merchant: { equals: merchantName, mode: 'insensitive' } },
            select: { id: true }
        });
        const productIds = products.map(p => p.id);
        if (productIds.length > 0) {
            await this.prisma.productColorVariant.deleteMany({
                where: { productId: { in: productIds } }
            });
        }
        const result = await this.prisma.product.deleteMany({
            where: { id: { in: productIds } }
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
    (0, common_1.Get)('pipeline/tables'),
    (0, swagger_1.ApiOperation)({ summary: 'Get AWIN raw/dev/prod pipeline table names' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getPipelineTables", null);
__decorate([
    (0, common_1.Post)('pipeline/extract-raw'),
    (0, swagger_1.ApiOperation)({ summary: 'Step 1: Extract AWIN data into AWIN_AFFILIAT_PRODUCTS_DATA_RAW' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "extractRaw", null);
__decorate([
    (0, common_1.Post)('pipeline/upload-raw-csv'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiOperation)({ summary: 'Step 1 alternative: Upload AWIN CSV into AWIN_AFFILIAT_PRODUCTS_DATA_RAW' }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "uploadRawCsv", null);
__decorate([
    (0, common_1.Post)('pipeline/transform-dev'),
    (0, swagger_1.ApiOperation)({ summary: 'Step 2: Transform AWIN RAW data into AWIN_AFFILIAT_PRODUCTS_DATA_DEV' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "transformDev", null);
__decorate([
    (0, common_1.Post)('pipeline/promote-prod'),
    (0, swagger_1.ApiOperation)({ summary: 'Step 3: Promote reviewed AWIN DEV data into AWIN_AFFILIAT_PRODUCTS_DATA_PROD' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "promoteProd", null);
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
    (0, common_1.Get)('products/mix-brands'),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch mixed brands products by category names' }),
    __param(0, (0, common_1.Query)('categories')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getMixBrandsProducts", null);
__decorate([
    (0, common_1.Get)('facets'),
    (0, swagger_1.ApiOperation)({ summary: 'Get unique facets for filters based on category' }),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Query)('subs')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getFacets", null);
__decorate([
    (0, common_1.Get)('products'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all saved products with pagination' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Return paginated products.' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('category')),
    __param(3, (0, common_1.Query)('subs')),
    __param(4, (0, common_1.Query)('search')),
    __param(5, (0, common_1.Query)('colors')),
    __param(6, (0, common_1.Query)('sizes')),
    __param(7, (0, common_1.Query)('materials')),
    __param(8, (0, common_1.Query)('merchants')),
    __param(9, (0, common_1.Query)('types')),
    __param(10, (0, common_1.Query)('minPrice')),
    __param(11, (0, common_1.Query)('maxPrice')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String, String, String]),
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
    (0, common_1.Get)('brands'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all unique brands from products' }),
    __param(0, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AwinController.prototype, "getBrands", null);
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
exports.AwinController = AwinController = AwinController_1 = __decorate([
    (0, swagger_1.ApiTags)('awin'),
    (0, common_1.Controller)('awin'),
    __metadata("design:paramtypes", [awin_service_1.AwinService,
        prisma_service_1.PrismaService,
        import_status_service_1.ImportStatusService,
        category_service_1.CategoryService])
], AwinController);
//# sourceMappingURL=awin.controller.js.map