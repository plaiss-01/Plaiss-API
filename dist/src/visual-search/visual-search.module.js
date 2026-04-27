"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualSearchModule = void 0;
const common_1 = require("@nestjs/common");
const visual_search_controller_1 = require("./visual-search.controller");
const visual_search_service_1 = require("./visual-search.service");
const prisma_module_1 = require("../prisma.module");
let VisualSearchModule = class VisualSearchModule {
};
exports.VisualSearchModule = VisualSearchModule;
exports.VisualSearchModule = VisualSearchModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [visual_search_controller_1.VisualSearchController],
        providers: [visual_search_service_1.VisualSearchService],
        exports: [visual_search_service_1.VisualSearchService],
    })
], VisualSearchModule);
//# sourceMappingURL=visual-search.module.js.map