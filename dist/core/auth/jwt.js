"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJwtUtil = createJwtUtil;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
function createJwtUtil(config, db) {
    const algorithm = 'HS256';
    return {
        signAccess(payload) {
            const jti = (0, crypto_1.randomUUID)();
            const options = {
                expiresIn: config.accessTTL,
                jwtid: jti,
                algorithm,
            };
            const tokenPayload = { ...payload, type: 'access' };
            return jsonwebtoken_1.default.sign(tokenPayload, config.secret, options);
        },
        signRefresh(payload) {
            const jti = (0, crypto_1.randomUUID)();
            const options = {
                expiresIn: config.refreshTTL,
                jwtid: jti,
                algorithm,
            };
            const tokenPayload = { ...payload, type: 'refresh' };
            return jsonwebtoken_1.default.sign(tokenPayload, config.secret, options);
        },
        async verify(token) {
            const payload = jsonwebtoken_1.default.verify(token, config.secret, { algorithms: [algorithm] });
            // Check if token is revoked by JTI
            const jti = payload?.jti;
            if (jti) {
                const revoked = await db.revokedToken.findUnique({ where: { jti } }).catch(() => null);
                if (revoked) {
                    throw new Error('Token revoked');
                }
            }
            return payload;
        },
        verifyWithoutRevocationCheck(token) {
            return jsonwebtoken_1.default.verify(token, config.secret, { algorithms: [algorithm] });
        },
    };
}
