import { ConfigService } from '@nestjs/config';
export declare class UploadService {
    private readonly configService;
    private readonly blobServiceClient;
    private readonly logger;
    private readonly containerName;
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
