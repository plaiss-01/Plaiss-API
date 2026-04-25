"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportStatusService = void 0;
const common_1 = require("@nestjs/common");
let ImportStatusService = class ImportStatusService {
    jobs = new Map();
    setJob(id, current, total, status = 'processing', message = '') {
        this.jobs.set(id, { current, total, status, message });
    }
    getJob(id) {
        return this.jobs.get(id);
    }
    updateJob(id, current, message) {
        const job = this.jobs.get(id);
        if (job) {
            job.current = current;
            if (message !== undefined)
                job.message = message;
        }
    }
    completeJob(id, message) {
        const job = this.jobs.get(id);
        if (job) {
            job.status = 'completed';
            job.message = message;
        }
    }
    failJob(id, message) {
        const job = this.jobs.get(id);
        if (job) {
            job.status = 'failed';
            job.message = message;
        }
    }
};
exports.ImportStatusService = ImportStatusService;
exports.ImportStatusService = ImportStatusService = __decorate([
    (0, common_1.Injectable)()
], ImportStatusService);
//# sourceMappingURL=import-status.service.js.map