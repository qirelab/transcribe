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
exports.SetupController = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let SetupController = class SetupController {
    dbService;
    constructor(dbService) {
        this.dbService = dbService;
    }
    getStatus() {
        const key = this.dbService.getApiKey();
        return { hasApiKey: !!key && key.trim().length > 0 };
    }
    configure(body) {
        if (!body || !body.apiKey || body.apiKey.trim().length === 0) {
            throw new common_1.BadRequestException('API key cannot be empty');
        }
        this.dbService.saveApiKey(body.apiKey.trim());
        return { success: true };
    }
};
exports.SetupController = SetupController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SetupController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SetupController.prototype, "configure", null);
exports.SetupController = SetupController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('setup'),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], SetupController);
//# sourceMappingURL=setup.controller.js.map