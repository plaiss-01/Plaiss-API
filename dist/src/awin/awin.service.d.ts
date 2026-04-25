import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
import { ImportStatusService } from './import-status.service';
export declare class AwinService {
    private readonly httpService;
    private readonly prisma;
    private readonly statusService;
    private readonly logger;
    constructor(httpService: HttpService, prisma: PrismaService, statusService: ImportStatusService);
    private slugify;
    addProductFromUrl(input: string): Promise<any>;
    processFeed(url: string, jobId?: string): Promise<{
        message: string;
        count: number;
    }>;
    scrapeSingleProduct(url: string): Promise<any>;
    private extractMerchant;
    private extractLeafCategory;
}
