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
    private readonly awinPipelineTables;
    private readonly rawInsertBatchSize;
    private readonly validSizeLabels;
    private readonly standardColourMap;
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
    getAwinPipelineTableNames(): {
        raw: string;
        dev: string;
        prod: string;
        note: string;
    };
    getAwinPipelineTableSummary(): Promise<{
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
    extractAwinFeedToRaw(url: string, jobId?: string, replace?: boolean): Promise<{
        message: string;
        table: string;
        count: number;
        replaced: boolean;
    }>;
    extractCsvFileToRaw(fileBuffer: Buffer, jobId: string, replace?: boolean): Promise<{
        table: string;
        count: number;
        replaced: boolean;
    }>;
    transformRawToDev(replace?: boolean, jobId?: string): Promise<{
        message: string;
        sourceTable: string;
        targetTable: string;
        transformed: number;
        skipped: number;
        rawRows: number;
    }>;
    loadDevToProd(replace?: boolean, syncProductTable?: boolean, jobId?: string): Promise<{
        message: string;
        sourceTable: string;
        targetTable: string;
        devRows: any;
        prodRows: any;
        syncedProducts: number;
        replaced: boolean;
    }>;
    private withAwinDownloadDefaults;
    private ensureAwinPipelineTables;
    private countAwinPipelineRows;
    private yieldToEventLoop;
    private ensurePipelineProductColumns;
    private createPipelineProductTableSql;
    private insertRawAwinRow;
    private insertRawAwinRows;
    private mapAwinRawRowToPipelineRow;
    private upsertPipelineProductRow;
    private syncProductModelFromAwinProd;
    private cleanAwinText;
    private combineAwinFields;
    private inferAwinProductModel;
    private inferAwinColour;
    private detectStandardColour;
    private inferAwinSizeStockStatus;
    private inferAwinIsRecliner;
    private inferAwinIsSofaBed;
    private extractBaseSkuFromAwinRow;
    private addVariantNumbers;
    private getFirstAwinValue;
    private parseAwinPrice;
    private getAwinValueGetter;
    private toNullableFloat;
    private toHttps;
    private upsertProduct;
    scrapeSingleProduct(url: string): Promise<any>;
    private extractMerchant;
    private extractLeafCategory;
    private getOrCreateCategoryRecord;
    deduplicateProducts(): Promise<{
        mergedCount: number;
        variantCount: number;
    }>;
}
