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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualSearchController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const visual_search_service_1 = require("./visual-search.service");
let VisualSearchController = class VisualSearchController {
    visualSearchService;
    constructor(visualSearchService) {
        this.visualSearchService = visualSearchService;
    }
    async searchByImage(file) {
        if (!file) {
            throw new common_1.BadRequestException('Image file is required');
        }
        const labels = await this.visualSearchService.detectLabels(file.buffer);
        if (labels.length === 0) {
            return {
                message: 'No recognizable objects found in the image',
                labels: [],
                products: []
            };
        }
        return this.visualSearchService.searchByLabels(labels);
    }
};
exports.VisualSearchController = VisualSearchController;
__decorate([
    (0, common_1.Post)('search'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VisualSearchController.prototype, "searchByImage", null);
exports.VisualSearchController = VisualSearchController = __decorate([
    (0, common_1.Controller)('visual-search'),
    __metadata("design:paramtypes", [visual_search_service_1.VisualSearchService])
], VisualSearchController);
//# sourceMappingURL=visual-search.controller.js.map