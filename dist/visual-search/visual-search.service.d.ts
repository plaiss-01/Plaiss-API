import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
export declare class VisualSearchService {
    private readonly configService;
    private readonly prisma;
    private readonly rekognitionClient;
    private readonly logger;
    constructor(configService: ConfigService, prisma: PrismaService);
    detectLabels(imageBuffer: Buffer): Promise<import("@aws-sdk/client-rekognition").Label[]>;
    searchByLabels(labels: any[]): Promise<never[] | {
        labels: any[];
        products: any[];
    }>;
}
