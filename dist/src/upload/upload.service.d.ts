import { ConfigService } from '@nestjs/config';
export declare class UploadService {
    private readonly configService;
    private readonly s3Client;
    private readonly logger;
    private readonly bucketName;
    private readonly region;
    constructor(configService: ConfigService);
    uploadFile(file: Express.Multer.File): Promise<{
        url: string;
        key: string;
    }>;
    uploadFiles(files: Express.Multer.File[]): Promise<{
        url: string;
        key: string;
    }[]>;
}
