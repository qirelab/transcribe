"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscribeModule = void 0;
const common_1 = require("@nestjs/common");
const transcribe_controller_1 = require("./transcribe.controller");
const transcribe_service_1 = require("./transcribe.service");
let TranscribeModule = class TranscribeModule {
};
exports.TranscribeModule = TranscribeModule;
exports.TranscribeModule = TranscribeModule = __decorate([
    (0, common_1.Module)({
        controllers: [transcribe_controller_1.TranscribeController],
        providers: [transcribe_service_1.TranscribeService],
    })
], TranscribeModule);
//# sourceMappingURL=transcribe.module.js.map