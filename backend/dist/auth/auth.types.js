"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_COOKIE_NAME = void 0;
exports.getJwtSecret = getJwtSecret;
exports.AUTH_COOKIE_NAME = 'transcribe_session';
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret)
        return secret;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be configured in production');
    }
    return 'development-only-change-me';
}
//# sourceMappingURL=auth.types.js.map