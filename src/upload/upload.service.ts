import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(UploadService.name);
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = (this.configService.get<string>('S3_REGION') || '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const accessKeyId = (
      this.configService.get<string>('AWS_ACCESS_KEY_ID') || ''
    )
      .trim()
      .replace(/^["']|["']$/g, '');
    const secretAccessKey = (
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || ''
    )
      .trim()
      .replace(/^["']|["']$/g, '');
    this.bucketName = (this.configService.get<string>('S3_BUCKET') || '')
      .trim()
      .replace(/^["']|["']$/g, '');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    console.log('S3 Configuration:', {
      region: this.region,
      bucket: this.bucketName,
      accessKeyId: accessKeyId ? '***' + accessKeyId.slice(-4) : 'MISSING',
    });
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
        })
      );

      // Construct the public URL (ensuring the key is properly URL-encoded)
      const encodedKey = key
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      
      // Using the modern virtual-hosted style URL
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodedKey}`;

      console.log('Generated S3 URL:', url);
      this.logger.log(`File uploaded successfully: ${url}`);
      return { url, key };
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
      throw error;
    }
  }

  async uploadFiles(files: Express.Multer.File[]) {
    const uploadPromises = files.map((file) => this.uploadFile(file));
    return Promise.all(uploadPromises);
  }
}
