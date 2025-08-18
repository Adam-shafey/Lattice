"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const jwt_1 = require("../core/auth/jwt");
const index_1 = require("../index");
const db_client_1 = require("../core/db/db-client");
(0, vitest_1.describe)('Auth Service', () => {
    let app;
    (0, vitest_1.beforeAll)(async () => {
        process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    });
    (0, vitest_1.beforeEach)(async () => {
        // Create fresh app instance for each test
        app = (0, index_1.Lattice)({
            db: { provider: 'sqlite' },
            adapter: 'fastify',
            jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test-secret' }
        });
        // Clean up database before each test - delete child records first
        await db_client_1.db.userPermission.deleteMany();
        await db_client_1.db.rolePermission.deleteMany();
        await db_client_1.db.userRole.deleteMany();
        await db_client_1.db.userContext.deleteMany();
        await db_client_1.db.passwordResetToken.deleteMany();
        await db_client_1.db.revokedToken.deleteMany();
        await db_client_1.db.user.deleteMany();
        await db_client_1.db.context.deleteMany();
        await db_client_1.db.role.deleteMany();
        await db_client_1.db.permission.deleteMany();
    });
    (0, vitest_1.afterAll)(async () => {
        if (app) {
            await app.shutdown();
        }
    });
    (0, vitest_1.describe)('JWT utilities', () => {
        (0, vitest_1.it)('signs and verifies access tokens', async () => {
            const jwt = (0, jwt_1.createJwtUtil)({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' }, db_client_1.db);
            const token = jwt.signAccess({ sub: 'user_1' });
            const payload = await jwt.verify(token);
            (0, vitest_1.expect)(payload.sub).toBe('user_1');
            (0, vitest_1.expect)(payload.type).toBe('access');
        });
        (0, vitest_1.it)('signs and verifies refresh tokens', async () => {
            const jwt = (0, jwt_1.createJwtUtil)({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' }, db_client_1.db);
            const token = jwt.signRefresh({ sub: 'user_1' });
            const payload = await jwt.verify(token);
            (0, vitest_1.expect)(payload.sub).toBe('user_1');
            (0, vitest_1.expect)(payload.type).toBe('refresh');
        });
        (0, vitest_1.it)('includes JTI in tokens', async () => {
            const jwt = (0, jwt_1.createJwtUtil)({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' }, db_client_1.db);
            const token = jwt.signAccess({ sub: 'user_1' });
            const payload = await jwt.verify(token);
            (0, vitest_1.expect)(payload.jti).toBeDefined();
            (0, vitest_1.expect)(typeof payload.jti).toBe('string');
        });
        (0, vitest_1.it)('rejects invalid tokens', async () => {
            const jwt = (0, jwt_1.createJwtUtil)({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' }, db_client_1.db);
            await (0, vitest_1.expect)(jwt.verify('invalid-token')).rejects.toThrow();
        });
        (0, vitest_1.it)('rejects tokens with wrong secret', async () => {
            const jwt1 = (0, jwt_1.createJwtUtil)({ secret: 'secret1', accessTTL: '15m', refreshTTL: '7d' }, db_client_1.db);
            const jwt2 = (0, jwt_1.createJwtUtil)({ secret: 'secret2', accessTTL: '15m', refreshTTL: '7d' }, db_client_1.db);
            const token = jwt1.signAccess({ sub: 'user_1' });
            await (0, vitest_1.expect)(jwt2.verify(token)).rejects.toThrow();
        });
    });
    (0, vitest_1.describe)('User authentication', () => {
        (0, vitest_1.it)('verifies user passwords', async () => {
            const user = await app.userService.createUser({
                email: 'test@example.com',
                password: 'securepassword123',
                context: { actorId: 'system' }
            });
            const isValid = await app.userService.verifyPassword(user.id, 'securepassword123');
            (0, vitest_1.expect)(isValid).toBe(true);
            const isInvalid = await app.userService.verifyPassword(user.id, 'wrongpassword');
            (0, vitest_1.expect)(isInvalid).toBe(false);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('handles password changes', async () => {
            const user = await app.userService.createUser({
                email: 'test2@example.com',
                password: 'oldpassword123',
                context: { actorId: 'system' }
            });
            // Change password
            await app.userService.changePassword(user.id, 'oldpassword123', 'newpassword123', { actorId: user.id });
            // Verify old password no longer works
            const oldValid = await app.userService.verifyPassword(user.id, 'oldpassword123');
            (0, vitest_1.expect)(oldValid).toBe(false);
            // Verify new password works
            const newValid = await app.userService.verifyPassword(user.id, 'newpassword123');
            (0, vitest_1.expect)(newValid).toBe(true);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('rejects password change with wrong old password', async () => {
            const user = await app.userService.createUser({
                email: 'test3@example.com',
                password: 'correctpassword123',
                context: { actorId: 'system' }
            });
            await (0, vitest_1.expect)(app.userService.changePassword(user.id, 'wrongpassword', 'newpassword123', { actorId: user.id })).rejects.toThrow();
            // Verify original password still works
            const stillValid = await app.userService.verifyPassword(user.id, 'correctpassword123');
            (0, vitest_1.expect)(stillValid).toBe(true);
            // No manual cleanup needed - beforeEach handles it
        });
    });
    (0, vitest_1.describe)('Token revocation', () => {
        (0, vitest_1.it)('tracks revoked tokens', async () => {
            // Create a real user first
            const user = await app.userService.createUser({
                email: 'revoke-test@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const jwt = (0, jwt_1.createJwtUtil)({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' }, db_client_1.db);
            const token = jwt.signAccess({ sub: user.id });
            const payload = await jwt.verify(token);
            const jti = payload.jti;
            // Revoke token
            await db_client_1.db.revokedToken.create({
                data: { jti, userId: user.id }
            });
            // Verify token is now invalid
            await (0, vitest_1.expect)(jwt.verify(token)).rejects.toThrow('Token revoked');
        });
    });
});
