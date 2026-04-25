import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
import { ImportStatusService } from './import-status.service';
import { CategoryService } from '../category/category.service';
export declare class AwinService {
    private readonly httpService;
    private readonly prisma;
    private readonly statusService;
    private readonly categoryService;
    private readonly logger;
    constructor(httpService: HttpService, prisma: PrismaService, statusService: ImportStatusService, categoryService: CategoryService);
    private slugify;
    addProductFromUrl(input: string): Promise<any>;
    processFeed(url: string, jobId?: string): Promise<{
        message: string;
        count: number;
    }>;
    processCsvFile(fileBuffer: Buffer, jobId: string): Promise<{
        count: number;
    }>;
    private upsertProduct;
    scrapeSingleProduct(url: string): Promise<any>;
    private extractMerchant;
    private extractLeafCategory;
}
