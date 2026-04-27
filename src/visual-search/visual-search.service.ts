import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RekognitionClient, DetectLabelsCommand } from '@aws-sdk/client-rekognition';
import { PrismaService } from '../prisma.service';

@Injectable()
export class VisualSearchService {
  private readonly rekognitionClient: RekognitionClient;
  private readonly logger = new Logger(VisualSearchService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const region = (this.configService.get<string>('REKOGNITION_REGION') || 'us-east-1')
      .trim()
      .replace(/^["']|["']$/g, '');
    const accessKeyId = (this.configService.get<string>('AWS_ACCESS_KEY_ID') || '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const secretAccessKey = (this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '')
      .trim()
      .replace(/^["']|["']$/g, '');

    this.rekognitionClient = new RekognitionClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async detectLabels(imageBuffer: Buffer) {
    try {
      const command = new DetectLabelsCommand({
        Image: {
          Bytes: imageBuffer,
        },
        MaxLabels: 10,
        MinConfidence: 75,
      });

      const response = await this.rekognitionClient.send(command);
      return response.Labels || [];
    } catch (error) {
      this.logger.error(`Rekognition error: ${error.message}`);
      throw error;
    }
  }

  async searchByLabels(labels: any[]) {
    // Extract label names
    const keywords = labels.map(label => label.Name.toLowerCase());
    
    if (keywords.length === 0) return [];

    this.logger.log(`Searching products for labels: ${keywords.join(', ')}`);

    // Search in Name, Description, Category, and Keywords
    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          ...keywords.map(kw => ({ name: { contains: kw, mode: 'insensitive' as const } })),
          ...keywords.map(kw => ({ description: { contains: kw, mode: 'insensitive' as const } })),
          ...keywords.map(kw => ({ category: { contains: kw, mode: 'insensitive' as const } })),
          ...keywords.map(kw => ({ keywords: { contains: kw, mode: 'insensitive' as const } })),
        ],
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      labels: keywords,
      products: products.map((p: any) => ({
        ...p,
        imageUrl: p.imageUrl || p.largeImage || p.awThumbUrl || '',
      })),
    };
  }
}
