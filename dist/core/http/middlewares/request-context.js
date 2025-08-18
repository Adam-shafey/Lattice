"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextMiddleware = requestContextMiddleware;
const crypto_1 = require("crypto");
function requestContextMiddleware() {
    return function (req, res, next) {
        try {
            const requestId = req.headers['x-request-id'] || (0, crypto_1.randomUUID)();
            req.requestId = String(requestId);
            req.clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;
            req.userAgent = req.headers['user-agent'] || null;
            if (typeof next === 'function')
                next();
        }
        catch (err) {
            if (typeof next === 'function')
                next(err);
        }
    };
}
