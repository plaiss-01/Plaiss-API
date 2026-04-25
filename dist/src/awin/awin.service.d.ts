import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
export declare class AwinService {
    private readonly httpService;
    private readonly prisma;
    private readonly logger;
    constructor(httpService: HttpService, prisma: PrismaService);
    private slugify;
    addProductFromUrl(url: string): Promise<any>;
    processFeed(url: string): Promise<{
        message: string;
        count: number;
    }>;
    scrapeSingleProduct(url: string): Promise<any>;
    private extractMerchant;
    private extractLeafCategory;
}
