import { AwinService } from './awin.service';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
export declare class AwinController {
    private readonly awinService;
    private readonly prisma;
    constructor(awinService: AwinService, prisma: PrismaService);
    addProduct(createProductDto: CreateProductDto): Promise<{
        id: string;
        awinId: string | null;
        name: string;
        description: string | null;
        price: number | null;
        currency: string | null;
        imageUrl: string | null;
        productUrl: string | null;
        merchant: string | null;
        category: string | null;
        slug: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | {
        message: string;
        count: number;
    }>;
    getAllProducts(page?: string, limit?: string, category?: string): Promise<{
        data: {
            id: string;
            name: string;
            description: string | null;
            price: number | null;
            imageUrl: string | null;
            productUrl: string | null;
            merchant: string | null;
            category: string | null;
            slug: string | null;
            createdAt: Date;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getCategories(): Promise<{
        slug: string | undefined;
    }[]>;
    getProductBySlug(slug: string): Promise<{
        id: string;
        awinId: string | null;
        name: string;
        description: string | null;
        price: number | null;
        currency: string | null;
        imageUrl: string | null;
        productUrl: string | null;
        merchant: string | null;
        category: string | null;
        slug: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | undefined>;
    getProductById(id: string): Promise<{
        id: string;
        awinId: string | null;
        name: string;
        description: string | null;
        price: number | null;
        currency: string | null;
        imageUrl: string | null;
        productUrl: string | null;
        merchant: string | null;
        category: string | null;
        slug: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    updateProduct(id: string, updateProductDto: UpdateProductDto): Promise<{
        id: string;
        awinId: string | null;
        name: string;
        description: string | null;
        price: number | null;
        currency: string | null;
        imageUrl: string | null;
        productUrl: string | null;
        merchant: string | null;
        category: string | null;
        slug: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteProduct(id: string): Promise<{
        id: string;
        awinId: string | null;
        name: string;
        description: string | null;
        price: number | null;
        currency: string | null;
        imageUrl: string | null;
        productUrl: string | null;
        merchant: string | null;
        category: string | null;
        slug: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
