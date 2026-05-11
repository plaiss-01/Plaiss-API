"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const awin_module_1 = require("./awin/awin.module");
const users_module_1 = require("./users/users.module");
const config_1 = require("@nestjs/config");
const upload_module_1 = require("./upload/upload.module");
const category_module_1 = require("./category/category.module");
const health_controller_1 = require("./health.controller");
const prisma_module_1 = require("./prisma.module");
const blog_module_1 = require("./blog/blog.module");
const visual_search_module_1 = require("./visual-search/visual-search.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            awin_module_1.AwinModule,
            users_module_1.UsersModule,
            upload_module_1.UploadModule,
            category_module_1.CategoryModule,
            blog_module_1.BlogModule,
            visual_search_module_1.VisualSearchModule
        ],
        controllers: [app_controller_1.AppController, health_controller_1.HealthController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map