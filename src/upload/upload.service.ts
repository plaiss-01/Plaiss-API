import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly logger = new Logger(UploadService.name);
  private readonly containerName: string;

  constructor(private readonly configService: ConfigService) {
    const connectionString =
      this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING') || '';
    this.containerName =
      this.configService.get<string>('AZURE_STORAGE_CONTAINER') || 'uploads';
    this.blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; key: string }> {
    const key = `uploads/${uuidv4()}-${file.originalname}`;
    const containerClient = this.blobServiceClient.getContainerClient(
      this.containerName,
    );
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    this.logger.log(`File uploaded: ${blockBlobClient.url}`);
    return { url: blockBlobClient.url, key };
  }

  async uploadFiles(
    files: Express.Multer.File[],
  ): Promise<Array<{ url: string; key: string }>> {
    return Promise.all(files.map((file) => this.uploadFile(file)));
  }
}
