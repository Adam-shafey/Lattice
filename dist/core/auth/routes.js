"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthMiddleware = requireAuthMiddleware;
exports.createAuthRoutes = createAuthRoutes;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_client_1 = require("../db/db-client");
const jwt_1 = require("./jwt");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
function getJwt() {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    return (0, jwt_1.createJwtUtil)({ secret, accessTTL: '15m', refreshTTL: '7d' });
}
function requireAuthMiddleware() {
    return async function (req, res, next) {
        try {
            const auth = req?.headers?.authorization;
            if (!auth || !auth.startsWith('Bearer ')) {
                const err = { statusCode: 401, message: 'Unauthorized' };
                if (res?.status)
                    return res.status(401).send(err);
                if (res?.code)
                    return res.code(401).send(err);
                if (next)
                    return next(err);
                return;
            }
            const token = auth.substring('Bearer '.length);
            const jwt = getJwt();
            const payload = jwt.verify(token);
            // Check revocation by JTI if present
            const jti = payload?.jti;
            if (jti) {
                const db = (0, db_client_1.getDbClient)();
                const revoked = await db.revokedToken.findUnique({ where: { jti } }).catch(() => null);
                if (revoked) {
                    const err = { statusCode: 401, message: 'Token revoked' };
                    if (res?.status)
                        return res.status(401).send(err);
                    if (res?.code)
                        return res.code(401).send(err);
                    if (next)
                        return next(err);
                    return;
                }
            }
            req.user = { id: payload.sub };
            if (next)
                return next();
        }
        catch (e) {
            const err = { statusCode: 401, message: 'Unauthorized' };
            if (res?.status)
                return res.status(401).send(err);
            if (res?.code)
                return res.code(401).send(err);
            if (next)
                return next(err);
        }
    };
}
function createAuthRoutes(app) {
    const db = (0, db_client_1.getDbClient)();
    const jwt = getJwt();
    app.route({
        method: 'POST',
        path: '/auth/login',
        handler: async ({ body }) => {
            const schema = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(6) });
            const parsed = schema.safeParse(body);
            if (!parsed.success)
                return { error: 'Invalid input', issues: parsed.error.issues };
            const { email, password } = parsed.data;
            const user = await db.user.findUnique({ where: { email } });
            if (!user)
                return { error: 'Invalid credentials' };
            const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!ok)
                return { error: 'Invalid credentials' };
            const access = jwt.signAccess({ sub: user.id });
            const refresh = jwt.signRefresh({ sub: user.id });
            await app.auditService.logTokenIssued(user.id, 'access');
            await app.auditService.logTokenIssued(user.id, 'refresh');
            return { accessToken: access, refreshToken: refresh };
        },
    });
    app.route({
        method: 'POST',
        path: '/auth/refresh',
        handler: async ({ body }) => {
            const schema = zod_1.z.object({ refreshToken: zod_1.z.string().min(1) });
            const parsed = schema.safeParse(body);
            if (!parsed.success)
                return { error: 'Invalid input', issues: parsed.error.issues };
            const { refreshToken } = parsed.data;
            const payload = jwt.verify(refreshToken);
            const userId = payload?.sub;
            const jti = payload?.jti;
            if (!userId)
                return { error: 'Invalid token' };
            const user = await db.user.findUnique({ where: { id: userId } });
            if (!user)
                return { error: 'Invalid token' };
            if (jti) {
                // Revoke old refresh on rotation
                await db.revokedToken.upsert({ where: { jti }, update: {}, create: { jti, userId } });
                await app.auditService.logTokenRevoked(userId, 'refresh');
            }
            const access = jwt.signAccess({ sub: user.id });
            const newRefresh = jwt.signRefresh({ sub: user.id });
            await app.auditService.logTokenIssued(user.id, 'access');
            await app.auditService.logTokenIssued(user.id, 'refresh');
            return { accessToken: access, refreshToken: newRefresh };
        },
    });
    // Explicit revocation endpoint
    app.route({
        method: 'POST',
        path: '/auth/revoke',
        preHandler: requireAuthMiddleware(),
        handler: async ({ body, user }) => {
            const schema = zod_1.z.object({ token: zod_1.z.string().min(1) });
            const parsed = schema.safeParse(body);
            if (!parsed.success)
                return { error: 'Invalid input', issues: parsed.error.issues };
            const { token } = parsed.data;
            const payload = jwt.verify(token);
            const jti = payload?.jti;
            if (!jti)
                return { ok: true };
            await db.revokedToken.upsert({ where: { jti }, update: {}, create: { jti, userId: user?.id ?? null } });
            await app.auditService.logTokenRevoked(user?.id ?? 'unknown', 'access');
            return { ok: true };
        },
    });
    // Password change (requires auth)
    app.route({
        method: 'POST',
        path: '/auth/password/change',
        preHandler: requireAuthMiddleware(),
        handler: async ({ body, user }) => {
            const schema = zod_1.z.object({ oldPassword: zod_1.z.string().min(6), newPassword: zod_1.z.string().min(6) });
            const parsed = schema.safeParse(body);
            if (!parsed.success)
                return { error: 'Invalid input', issues: parsed.error.issues };
            const { oldPassword, newPassword } = parsed.data;
            const existing = await db.user.findUnique({ where: { id: user.id } });
            if (!existing)
                return { error: 'Invalid user' };
            const ok = await bcryptjs_1.default.compare(oldPassword, existing.passwordHash);
            if (!ok)
                return { error: 'Invalid credentials' };
            const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
            await db.user.update({ where: { id: existing.id }, data: { passwordHash } });
            return { ok: true };
        },
    });
    // Password reset request (by email)
    app.route({
        method: 'POST',
        path: '/auth/password/reset/request',
        handler: async ({ body }) => {
            const schema = zod_1.z.object({ email: zod_1.z.string().email() });
            const parsed = schema.safeParse(body);
            if (!parsed.success)
                return { error: 'Invalid input', issues: parsed.error.issues };
            const { email } = parsed.data;
            const user = await db.user.findUnique({ where: { email } });
            if (!user)
                return { ok: true };
            const token = (0, crypto_1.randomUUID)();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            await db.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });
            // In real impl, email the token. Here we return it for testability.
            return { ok: true, token };
        },
    });
    // Password reset confirm
    app.route({
        method: 'POST',
        path: '/auth/password/reset/confirm',
        handler: async ({ body }) => {
            const schema = zod_1.z.object({ token: zod_1.z.string().min(1), newPassword: zod_1.z.string().min(6) });
            const parsed = schema.safeParse(body);
            if (!parsed.success)
                return { error: 'Invalid input', issues: parsed.error.issues };
            const { token, newPassword } = parsed.data;
            const row = await db.passwordResetToken.findUnique({ where: { token } });
            if (!row || row.expiresAt < new Date())
                return { error: 'Invalid token' };
            const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
            await db.user.update({ where: { id: row.userId }, data: { passwordHash } });
            await db.passwordResetToken.delete({ where: { token } });
            return { ok: true };
        },
    });
}
