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
const storage_blob_1 = require("@azure/storage-blob");
const uuid_1 = require("uuid");
let UploadService = UploadService_1 = class UploadService {
    configService;
    blobServiceClient;
    logger = new common_1.Logger(UploadService_1.name);
    containerName;
    constructor(configService) {
        this.configService = configService;
        const connectionString = this.configService.get('AZURE_STORAGE_CONNECTION_STRING');
        this.containerName = this.configService.get('AZURE_STORAGE_CONTAINER') || 'uploads';
        this.blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
    }
    async uploadFile(file) {
        const blobName = `uploads/${(0, uuid_1.v4)()}-${file.originalname}`;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(file.buffer, {
            blobHTTPHeaders: { blobContentType: file.mimetype },
        });
        const url = blockBlobClient.url;
        this.logger.log(`File uploaded successfully: ${url}`);
        return { url, key: blobName };
    }
    async uploadFiles(files) {
        return Promise.all(files.map((file) => this.uploadFile(file)));
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = UploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadService);
//# sourceMappingURL=upload.service.js.map