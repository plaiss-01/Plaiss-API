import { AwinService } from './awin.service';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ImportStatusService } from './import-status.service';
import { CategoryService } from '../category/category.service';
export declare class AwinController {
    private readonly awinService;
    private readonly prisma;
    private readonly statusService;
    private readonly categoryService;
    constructor(awinService: AwinService, prisma: PrismaService, statusService: ImportStatusService, categoryService: CategoryService);
    private productsCache;
    private readonly CACHE_TTL;
    private readonly MAX_CACHE_SIZE;
    private readonly productListSelect;
    private isUsableImageValue;
    private decodeProductServeSource;
    private normalizeProductImageUrl;
    private getBestProductImage;
    private enhanceProductImages;
    getPipelineTables(): Promise<{
        counts: {
            raw: number;
            dev: number;
            prod: number;
        };
        total: number;
        raw: string;
        dev: string;
        prod: string;
        note: string;
    }>;
    extractRaw(body: {
        url: string;
        replace?: boolean;
    }): Promise<{
        jobId: string;
        message: string;
        table: string;
    }>;
    uploadRawCsv(file: Express.Multer.File, body: {
        replace?: string;
    }): Promise<{
        jobId: string;
        message: string;
        table: string;
    }>;
    transformDev(body: {
        replace?: boolean;
    }): Promise<{
        jobId: string;
        message: string;
        sourceTable: string;
        targetTable: string;
    }>;
    promoteProd(body: {
        replace?: boolean;
        syncProductTable?: boolean;
    }): Promise<{
        jobId: string;
        message: string;
        sourceTable: string;
        targetTable: string;
    }>;
    addProduct(createProductDto: CreateProductDto): Promise<any>;
    uploadCsv(file: Express.Multer.File): Promise<{
        jobId: string;
        message: string;
    }>;
    getImportStatus(id: string): Promise<{
        current: number;
        total: number;
        status: string;
        message: string;
        timestamp: number;
        result?: Record<string, unknown>;
    } | undefined>;
    getMixBrandsProducts(categories: string, limit?: string): Promise<any[]>;
    getFacets(category?: string, subs?: string): Promise<{
        sizes: any;
        colors: any;
        materials: any;
        priceMin: number;
        priceMax: number;
    }>;
    getAllProducts(page?: string, limit?: string, category?: string, subs?: string, search?: string, colors?: string, sizes?: string, materials?: string, minPrice?: string, maxPrice?: string): Promise<any>;
    getMerchants(): Promise<(string | null)[]>;
    getBrands(category?: string): Promise<(string | null)[]>;
    getCategories(): Promise<any[]>;
    getProductBySlug(slug: string): Promise<any>;
    getProductById(id: string): Promise<any>;
    updateProduct(id: string, updateProductDto: UpdateProductDto): Promise<{
        id: string;
        name: string;
        slug: string | null;
        description: string | null;
        price: number | null;
        currency: string | null;
        imageUrl: string | null;
        productUrl: string | null;
        merchant: string | null;
        category: string | null;
        merchantProductId: string | null;
        merchantCategory: string | null;
        categoryId: string | null;
        brandName: string | null;
        colour: string | null;
        productModel: string | null;
        productType: string | null;
        createdAt: Date | null;
        productModelClean: string | null;
        colourClean: string | null;
        sizeStockStatusClean: string | null;
        isRecliner: string | null;
        isSofaBed: string | null;
        baseSku: string | null;
        colourVariantNumber: number | null;
        originalPriceClean: number | null;
        discountedPriceClean: number | null;
        saving: number | null;
        rawRow: string | null;
        transformedAt: Date | null;
        salesDiscount: string | null;
    }>;
    deleteProduct(id: string): Promise<{
        id: string;
        name: string;
        slug: string | null;
        description: string | null;
        price: number | null;
        currency: string | null;
        imageUrl: string | null;
        productUrl: string | null;
        merchant: string | null;
        category: string | null;
        merchantProductId: string | null;
        merchantCategory: string | null;
        categoryId: string | null;
        brandName: string | null;
        colour: string | null;
        productModel: string | null;
        productType: string | null;
        createdAt: Date | null;
        productModelClean: string | null;
        colourClean: string | null;
        sizeStockStatusClean: string | null;
        isRecliner: string | null;
        isSofaBed: string | null;
        baseSku: string | null;
        colourVariantNumber: number | null;
        originalPriceClean: number | null;
        discountedPriceClean: number | null;
        saving: number | null;
        rawRow: string | null;
        transformedAt: Date | null;
        salesDiscount: string | null;
    }>;
    deleteProductsByMerchant(merchantName: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    deduplicate(): Promise<{
        mergedCount: number;
        variantCount: number;
    }>;
}
