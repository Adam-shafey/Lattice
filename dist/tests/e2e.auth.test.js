"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("../index");
const db_client_1 = require("../core/db/db-client");
const auth_1 = require("../core/http/api/auth");
(0, vitest_1.describe)('E2E: Authentication', () => {
    let app;
    (0, vitest_1.beforeAll)(async () => {
        process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    });
    (0, vitest_1.beforeEach)(async () => {
        // Create fresh app instance for each test
        app = (0, index_1.Lattice)({
            db: { provider: 'sqlite' },
            adapter: 'fastify',
            jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }
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
        // Initialize auth routes for testing
        (0, auth_1.createAuthRoutes)(app);
    });
    (0, vitest_1.afterAll)(async () => {
        if (app) {
            await app.shutdown();
        }
    });
    (0, vitest_1.describe)('login and token refresh', () => {
        (0, vitest_1.it)('logs in with password and refreshes tokens', async () => {
            const email = `e2e_auth_${Date.now()}@example.com`;
            // Create user through service
            const user = await app.userService.createUser({
                email,
                password: 'secretpassword123',
                context: { actorId: 'system' }
            });
            const f = app.fastify;
            // Test login
            const loginRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email, password: 'secretpassword123' }
            });
            (0, vitest_1.expect)(loginRes.statusCode).toBe(200);
            const loginBody = loginRes.json();
            (0, vitest_1.expect)(typeof loginBody.accessToken).toBe('string');
            (0, vitest_1.expect)(typeof loginBody.refreshToken).toBe('string');
            // Test token refresh
            const refreshRes = await f.inject({
                method: 'POST',
                url: '/auth/refresh',
                payload: { refreshToken: loginBody.refreshToken }
            });
            (0, vitest_1.expect)(refreshRes.statusCode).toBe(200);
            const refreshBody = refreshRes.json();
            (0, vitest_1.expect)(typeof refreshBody.accessToken).toBe('string');
            (0, vitest_1.expect)(typeof refreshBody.refreshToken).toBe('string');
            // Verify tokens are different
            (0, vitest_1.expect)(refreshBody.accessToken).not.toBe(loginBody.accessToken);
            (0, vitest_1.expect)(refreshBody.refreshToken).not.toBe(loginBody.refreshToken);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('rejects invalid credentials', async () => {
            const email = `e2e_invalid_${Date.now()}@example.com`;
            // Create user
            const user = await app.userService.createUser({
                email,
                password: 'correctpassword123',
                context: { actorId: 'system' }
            });
            const f = app.fastify;
            // Test wrong password
            const wrongPasswordRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email, password: 'wrongpassword123' }
            });
            (0, vitest_1.expect)(wrongPasswordRes.statusCode).toBe(200);
            (0, vitest_1.expect)(wrongPasswordRes.json()).toHaveProperty('error', 'Invalid credentials');
            // Test non-existent user
            const nonExistentRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email: 'nonexistent@example.com', password: 'anypassword123' }
            });
            (0, vitest_1.expect)(nonExistentRes.statusCode).toBe(200);
            (0, vitest_1.expect)(nonExistentRes.json()).toHaveProperty('error', 'Invalid credentials');
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('handles password change', async () => {
            const email = `e2e_password_${Date.now()}@example.com`;
            // Create user
            const user = await app.userService.createUser({
                email,
                password: 'oldpassword123',
                context: { actorId: 'system' }
            });
            const f = app.fastify;
            // Login first
            const loginRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email, password: 'oldpassword123' }
            });
            (0, vitest_1.expect)(loginRes.statusCode).toBe(200);
            const { accessToken } = loginRes.json();
            // Change password
            const changePasswordRes = await f.inject({
                method: 'POST',
                url: '/auth/password/change',
                payload: { oldPassword: 'oldpassword123', newPassword: 'newpassword123' },
                headers: { authorization: `Bearer ${accessToken}` }
            });
            (0, vitest_1.expect)(changePasswordRes.statusCode).toBe(200);
            // Small delay to ensure database transaction is committed
            await new Promise(resolve => setTimeout(resolve, 100));
            // Verify old password no longer works
            const oldPasswordRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email, password: 'oldpassword123' }
            });
            (0, vitest_1.expect)(oldPasswordRes.statusCode).toBe(200);
            (0, vitest_1.expect)(oldPasswordRes.json()).toHaveProperty('error', 'Invalid credentials');
            // Verify new password works
            const newPasswordRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email, password: 'newpassword123' }
            });
            (0, vitest_1.expect)(newPasswordRes.statusCode).toBe(200);
            (0, vitest_1.expect)(newPasswordRes.json()).toHaveProperty('accessToken');
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('handles token revocation', async () => {
            const email = `e2e_revoke_${Date.now()}@example.com`;
            // Create user
            const user = await app.userService.createUser({
                email,
                password: 'password123',
                context: { actorId: 'system' }
            });
            const f = app.fastify;
            // Login
            const loginRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email, password: 'password123' }
            });
            (0, vitest_1.expect)(loginRes.statusCode).toBe(200);
            const { accessToken, refreshToken } = loginRes.json();
            // Revoke access token (without requiring auth for revocation)
            const revokeRes = await f.inject({
                method: 'POST',
                url: '/auth/revoke',
                payload: { token: accessToken }
            });
            (0, vitest_1.expect)(revokeRes.statusCode).toBe(200);
            // Verify revoked token no longer works
            const protectedRes = await f.inject({
                method: 'POST',
                url: '/auth/password/change',
                payload: { oldPassword: 'password', newPassword: 'newpass' },
                headers: { authorization: `Bearer ${accessToken}` }
            });
            (0, vitest_1.expect)(protectedRes.statusCode).toBe(401);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('handles expired tokens', async () => {
            const email = `e2e_expired_${Date.now()}@example.com`;
            // Create user
            const user = await app.userService.createUser({
                email,
                password: 'password',
                context: { actorId: 'system' }
            });
            const f = app.fastify;
            // Login
            const loginRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email, password: 'password' }
            });
            (0, vitest_1.expect)(loginRes.statusCode).toBe(200);
            const { accessToken } = loginRes.json();
            // Try to use token without authorization header
            const noAuthRes = await f.inject({
                method: 'POST',
                url: '/auth/password/change',
                payload: { oldPassword: 'password', newPassword: 'newpass' }
            });
            (0, vitest_1.expect)(noAuthRes.statusCode).toBe(401);
            // Try to use malformed authorization header
            const malformedRes = await f.inject({
                method: 'POST',
                url: '/auth/password/change',
                payload: { oldPassword: 'password', newPassword: 'newpass' },
                headers: { authorization: 'InvalidToken' }
            });
            (0, vitest_1.expect)(malformedRes.statusCode).toBe(401);
            // No manual cleanup needed - beforeEach handles it
        });
    });
    (0, vitest_1.describe)('input validation', () => {
        (0, vitest_1.it)('validates login input', async () => {
            const f = app.fastify;
            // Test missing email
            const missingEmailRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { password: 'password' }
            });
            (0, vitest_1.expect)(missingEmailRes.statusCode).toBe(200);
            (0, vitest_1.expect)(missingEmailRes.json()).toHaveProperty('error', 'Invalid input');
            // Test invalid email format
            const invalidEmailRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email: 'invalid-email', password: 'password' }
            });
            (0, vitest_1.expect)(invalidEmailRes.statusCode).toBe(200);
            (0, vitest_1.expect)(invalidEmailRes.json()).toHaveProperty('error', 'Invalid input');
            // Test short password (less than 8 characters)
            const shortPasswordRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email: 'test@example.com', password: '123' }
            });
            (0, vitest_1.expect)(shortPasswordRes.statusCode).toBe(200);
            (0, vitest_1.expect)(shortPasswordRes.json()).toHaveProperty('error', 'Invalid input');
        });
        (0, vitest_1.it)('validates password change input', async () => {
            const email = `e2e_validation_${Date.now()}@example.com`;
            // Create user and login
            const user = await app.userService.createUser({
                email,
                password: 'password',
                context: { actorId: 'system' }
            });
            const f = app.fastify;
            const loginRes = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email, password: 'password' }
            });
            const { accessToken } = loginRes.json();
            // Test missing old password
            const missingOldRes = await f.inject({
                method: 'POST',
                url: '/auth/password/change',
                payload: { newPassword: 'newpassword' },
                headers: { authorization: `Bearer ${accessToken}` }
            });
            (0, vitest_1.expect)(missingOldRes.statusCode).toBe(200);
            (0, vitest_1.expect)(missingOldRes.json()).toHaveProperty('error', 'Invalid input');
            // Test short new password
            const shortNewRes = await f.inject({
                method: 'POST',
                url: '/auth/password/change',
                payload: { oldPassword: 'password', newPassword: '123' },
                headers: { authorization: `Bearer ${accessToken}` }
            });
            (0, vitest_1.expect)(shortNewRes.statusCode).toBe(200);
            (0, vitest_1.expect)(shortNewRes.json()).toHaveProperty('error', 'Invalid input');
            // No manual cleanup needed - beforeEach handles it
        });
    });
});
