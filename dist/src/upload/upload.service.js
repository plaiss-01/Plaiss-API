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
var UploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
let UploadService = UploadService_1 = class UploadService {
    configService;
    s3Client;
    logger = new common_1.Logger(UploadService_1.name);
    bucketName;
    region;
    constructor(configService) {
        this.configService = configService;
        this.region = (this.configService.get('S3_REGION') || '')
            .trim()
            .replace(/^["']|["']$/g, '');
        const accessKeyId = (this.configService.get('AWS_ACCESS_KEY_ID') || '')
            .trim()
            .replace(/^["']|["']$/g, '');
        const secretAccessKey = (this.configService.get('AWS_SECRET_ACCESS_KEY') || '')
            .trim()
            .replace(/^["']|["']$/g, '');
        this.bucketName = (this.configService.get('S3_BUCKET') || '')
            .trim()
            .replace(/^["']|["']$/g, '');
        this.s3Client = new client_s3_1.S3Client({
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
    async uploadFile(file) {
        const key = `uploads/${(0, uuid_1.v4)()}-${file.originalname}`;
        try {
            await this.s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
            }));
            const encodedKey = key
                .split('/')
                .map((segment) => encodeURIComponent(segment))
                .join('/');
            const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodedKey}`;
            console.log('Generated S3 URL:', url);
            this.logger.log(`File uploaded successfully: ${url}`);
            return { url, key };
        }
        catch (error) {
            this.logger.error(`Failed to upload file to S3: ${error.message}`);
            throw error;
        }
    }
    async uploadFiles(files) {
        const uploadPromises = files.map((file) => this.uploadFile(file));
        return Promise.all(uploadPromises);
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = UploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadService);
//# sourceMappingURL=upload.service.js.map