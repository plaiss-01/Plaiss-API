"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var VisualSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualSearchService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_rekognition_1 = require("@aws-sdk/client-rekognition");
const prisma_service_1 = require("../prisma.service");
let VisualSearchService = VisualSearchService_1 = class VisualSearchService {
    configService;
    prisma;
    rekognitionClient;
    logger = new common_1.Logger(VisualSearchService_1.name);
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        const region = (this.configService.get('REKOGNITION_REGION') || 'us-east-1')
            .trim()
            .replace(/^["']|["']$/g, '');
        const accessKeyId = (this.configService.get('AWS_ACCESS_KEY_ID') || '')
            .trim()
            .replace(/^["']|["']$/g, '');
        const secretAccessKey = (this.configService.get('AWS_SECRET_ACCESS_KEY') || '')
            .trim()
            .replace(/^["']|["']$/g, '');
        this.rekognitionClient = new client_rekognition_1.RekognitionClient({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    async detectLabels(imageBuffer) {
        try {
            const command = new client_rekognition_1.DetectLabelsCommand({
                Image: {
                    Bytes: imageBuffer,
                },
                MaxLabels: 10,
                MinConfidence: 75,
            });
            const response = await this.rekognitionClient.send(command);
            return response.Labels || [];
        }
        catch (error) {
            this.logger.error(`Rekognition error: ${error.message}`);
            throw error;
        }
    }
    async searchByLabels(labels) {
        const keywords = labels.map(label => label.Name.toLowerCase());
        if (keywords.length === 0)
            return [];
        this.logger.log(`Searching products for labels: ${keywords.join(', ')}`);
        const products = await this.prisma.product.findMany({
            where: {
                OR: [
                    ...keywords.map(kw => ({ name: { contains: kw, mode: 'insensitive' } })),
                    ...keywords.map(kw => ({ description: { contains: kw, mode: 'insensitive' } })),
                    ...keywords.map(kw => ({ category: { contains: kw, mode: 'insensitive' } })),
                    ...keywords.map(kw => ({ keywords: { contains: kw, mode: 'insensitive' } })),
                ],
            },
            take: 20,
            orderBy: {
                createdAt: 'desc',
            },
        });
        return {
            labels: keywords,
            products: products.map((p) => ({
                ...p,
                imageUrl: p.imageUrl || p.largeImage || p.awThumbUrl || '',
            })),
        };
    }
};
exports.VisualSearchService = VisualSearchService;
exports.VisualSearchService = VisualSearchService = VisualSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], VisualSearchService);
//# sourceMappingURL=visual-search.service.js.map