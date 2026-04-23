import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
export declare class AwinService {
    private readonly httpService;
    private readonly prisma;
    private readonly logger;
    constructor(httpService: HttpService, prisma: PrismaService);
    addProductFromUrl(url: string): Promise<{
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
        createdAt: Date;
        updatedAt: Date;
    } | {
        message: string;
        count: number;
    }>;
    processFeed(url: string): Promise<{
        message: string;
        count: number;
    }>;
    scrapeSingleProduct(url: string): Promise<{
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
        createdAt: Date;
        updatedAt: Date;
    }>;
    private extractMerchant;
}
