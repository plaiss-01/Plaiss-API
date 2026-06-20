import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

@Injectable()
export class VisualSearchService {
  private readonly logger = new Logger(VisualSearchService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async detectLabels(
    imageBuffer: Buffer,
  ): Promise<Array<{ Name: string; Confidence: number }>> {
    const endpoint = (
      this.configService.get<string>('AZURE_VISION_ENDPOINT') || ''
    ).replace(/\/$/, '');
    const key = this.configService.get<string>('AZURE_VISION_KEY') || '';

    const url = `${endpoint}/computervision/imageanalysis:analyze?api-version=2023-02-01-preview&features=tags`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      this.logger.error(`Azure Vision error: ${response.statusText}`);
      throw new Error(`Azure Vision error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return (data.tagsResult?.values || []).map((tag: any) => ({
      Name: tag.name,
      Confidence: tag.confidence * 100,
    }));
  }

  async searchByLabels(labels: any[]) {
    const keywords = labels.map((label: any) => label.Name.toLowerCase());

    if (keywords.length === 0) return [];

    this.logger.log(`Searching products for labels: ${keywords.join(', ')}`);

    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          ...keywords.map((kw) => ({
            name: { contains: kw, mode: 'insensitive' as const },
          })),
          ...keywords.map((kw) => ({
            description: { contains: kw, mode: 'insensitive' as const },
          })),
          ...keywords.map((kw) => ({
            category: { contains: kw, mode: 'insensitive' as const },
          })),
        ],
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
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
