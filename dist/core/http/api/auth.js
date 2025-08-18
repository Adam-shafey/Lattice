"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthMiddleware = requireAuthMiddleware;
exports.createAuthRoutes = createAuthRoutes;
const jwt_1 = require("../../auth/jwt");
const zod_1 = require("zod");
const logger_1 = require("../../logger");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
function getJwt(app) {
    const secret = app.jwtConfig?.secret || process.env.JWT_SECRET || 'dev-secret';
    const accessTTL = app.jwtConfig?.accessTTL || '15m';
    const refreshTTL = app.jwtConfig?.refreshTTL || '7d';
    return (0, jwt_1.createJwtUtil)({ secret, accessTTL, refreshTTL }, app.db);
}
function requireAuthMiddleware(app) {
    return async function (req, res, next) {
        logger_1.logger.log('🔑 [REQUIRE_AUTH] Middleware invoked');
        try {
            const auth = req?.headers?.authorization;
            if (!auth || !auth.startsWith('Bearer ')) {
                logger_1.logger.log('🔑 [REQUIRE_AUTH] ❌ No Bearer token found');
                const err = { statusCode: 401, message: 'Unauthorized' };
                if (res?.sent)
                    return;
                if (res?.status)
                    return res.status(401).send(err);
                if (res?.code)
                    return res.code(401).send(err);
                if (next)
                    return next(err);
                return;
            }
            const token = auth.substring('Bearer '.length);
            const jwt = getJwt(app);
            const payload = await jwt.verify(token);
            req.user = { id: payload.sub };
            logger_1.logger.log('🔑 [REQUIRE_AUTH] ✅ Authenticated user', { userId: payload.sub });
            if (next)
                return next();
        }
        catch (e) {
            logger_1.logger.error('🔑 [REQUIRE_AUTH] ❌ Error during auth:', e);
            const err = { statusCode: 401, message: 'Unauthorized' };
            if (res?.sent)
                return;
            if (res?.status)
                return res.status(401).send(err);
            if (res?.code)
                return res.code(401).send(err);
            if (next)
                return next(err);
            return; // Don't continue to handler
        }
    };
}
function createAuthRoutes(app, prefix = '') {
    const jwt = getJwt(app);
    const p = prefix;
    const windowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const loginMax = parseInt(process.env.AUTH_LOGIN_RATE_LIMIT || '5', 10);
    const refreshMax = parseInt(process.env.AUTH_REFRESH_RATE_LIMIT || '10', 10);
    const revokeMax = parseInt(process.env.AUTH_REVOKE_RATE_LIMIT || '10', 10);
    const buildExpressLimiter = (max) => (0, express_rate_limit_1.default)({ windowMs, max, standardHeaders: true, legacyHeaders: false });
    const buildFastifyConfig = (max) => ({
        rateLimit: { max, timeWindow: windowMs },
    });
    function rateLimitOpts(max) {
        if (app.express)
            return { preHandler: buildExpressLimiter(max) };
        if (app.fastify)
            return { config: buildFastifyConfig(max) };
        return {};
    }
    app.route({
        method: 'POST',
        path: `${p}/auth/login`,
        ...rateLimitOpts(loginMax),
        handler: async ({ body }) => {
            const schema = zod_1.z.object({
                email: zod_1.z.string().email(),
                // Require passwords to be at least 8 characters
                password: zod_1.z.string().min(8)
            });
            try {
                const parsed = schema.safeParse(body);
                if (!parsed.success)
                    return { error: 'Invalid input', issues: parsed.error.issues };
                const { email, password } = parsed.data;
                // Get user by email
                const user = await app.userService.getUserByEmail(email);
                if (!user)
                    return { error: 'Invalid credentials' };
                // Verify password
                const isValid = await app.userService.verifyPassword(user.id, password);
                if (!isValid)
                    return { error: 'Invalid credentials' };
                // Generate tokens
                const access = jwt.signAccess({ sub: user.id });
                const refresh = jwt.signRefresh({ sub: user.id });
                return { accessToken: access, refreshToken: refresh };
            }
            catch (error) {
                return { error: error.message || 'Login failed' };
            }
        },
    });
    app.route({
        method: 'POST',
        path: `${p}/auth/refresh`,
        ...rateLimitOpts(refreshMax),
        handler: async ({ body }) => {
            const schema = zod_1.z.object({
                refreshToken: zod_1.z.string().min(1)
            });
            try {
                const parsed = schema.safeParse(body);
                if (!parsed.success)
                    return { error: 'Invalid input', issues: parsed.error.issues };
                const { refreshToken } = parsed.data;
                const payload = jwt.verifyWithoutRevocationCheck(refreshToken);
                const userId = payload.sub;
                const jti = payload.jti;
                if (!userId)
                    return { error: 'Invalid token' };
                // Verify user exists
                const user = await app.userService.getUserById(userId);
                if (!user)
                    return { error: 'Invalid token' };
                // Revoke old refresh token if JTI present
                if (jti) {
                    await app.db.revokedToken.upsert({
                        where: { jti },
                        update: {},
                        create: { jti, userId }
                    });
                }
                // Generate new tokens
                const access = jwt.signAccess({ sub: user.id });
                const newRefresh = jwt.signRefresh({ sub: user.id });
                return { accessToken: access, refreshToken: newRefresh };
            }
            catch (error) {
                return { error: error.message || 'Token refresh failed' };
            }
        },
    });
    // Explicit revocation endpoint
    app.route({
        method: 'POST',
        path: `${p}/auth/revoke`,
        ...rateLimitOpts(revokeMax),
        handler: async ({ body }) => {
            const schema = zod_1.z.object({
                token: zod_1.z.string().min(1)
            });
            try {
                const parsed = schema.safeParse(body);
                if (!parsed.success)
                    return { error: 'Invalid input', issues: parsed.error.issues };
                const { token } = parsed.data;
                const payload = jwt.verifyWithoutRevocationCheck(token);
                const jti = payload.jti;
                if (!jti)
                    return { ok: true };
                // Revoke token
                const revokedToken = await app.db.revokedToken.upsert({
                    where: { jti },
                    update: {},
                    create: { jti, userId: payload?.sub ?? null }
                });
                return { ok: true };
            }
            catch (error) {
                return { error: error.message || 'Token revocation failed' };
            }
        },
    });
    // Password change
    const changeSchema = zod_1.z.object({
        userId: zod_1.z.string().min(1).optional(),
        oldPassword: zod_1.z.string().min(6),
        newPassword: zod_1.z.string().min(6),
    });
    app.route({
        method: 'POST',
        path: `${p}/auth/password/change`,
        ...(app.authnEnabled && { preHandler: app.requireAuth() }),
        handler: async ({ body, user }) => {
            const parsed = changeSchema.safeParse(body);
            if (!parsed.success)
                return { error: 'Invalid input', issues: parsed.error.issues };
            const { oldPassword, newPassword } = parsed.data;
            const userId = app.authnEnabled ? user?.id : parsed.data.userId;
            if (app.authnEnabled && !userId) {
                return { error: 'Unauthorized' };
            }
            await app.userService.changePassword(userId, oldPassword, newPassword, {
                actorId: userId,
            });
            return { ok: true };
        },
    });
}
