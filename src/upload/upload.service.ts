import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(UploadService.name);
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('S3_REGION') as string,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') as string,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') as string,
      },
    });
    this.bucketName = this.configService.get<string>('S3_BUCKET') as string;
  }

  async uploadFile(file: Express.Multer.File) {
    const key = `uploads/${uuidv4()}-${file.originalname}`;
    
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      // Construct the public URL (assuming the bucket has public read access)
      const url = `https://${this.bucketName}.s3.${this.configService.get<string>('S3_REGION')}.amazonaws.com/${key}`;
      
      this.logger.log(`File uploaded successfully: ${url}`);
      return { url, key };
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
      throw error;
    }
  }
}
