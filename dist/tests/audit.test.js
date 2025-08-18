"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("../index");
const db_client_1 = require("../core/db/db-client");
(0, vitest_1.describe)('Audit Service', () => {
    let app;
    (0, vitest_1.beforeAll)(async () => {
        process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    });
    (0, vitest_1.beforeEach)(async () => {
        // Create fresh app instance for each test
        app = (0, index_1.CoreSaaS)({
            db: { provider: 'sqlite' },
            adapter: 'fastify',
            jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' },
            audit: {
                enabled: true,
                batchSize: 1, // Disable batching for tests
                flushInterval: 0, // Immediate flushing
                sinks: ['db'] // Only use database sink for tests
            }
        });
        // Clean up database before each test - delete child records first
        await db_client_1.db.auditLog.deleteMany();
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
    (0, vitest_1.describe)('audit logging toggle', () => {
        (0, vitest_1.it)('logs when enabled', async () => {
            // Create a test user for the audit log
            const user = await app.userService.createUser({
                email: 'test-user@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const before = await db_client_1.db.auditLog.count();
            await app.auditService.log({
                action: 'test.event',
                success: true,
                actorId: user.id
            });
            const after = await db_client_1.db.auditLog.count();
            (0, vitest_1.expect)(after).toBe(before + 1);
        });
        (0, vitest_1.it)('does not log when disabled', async () => {
            const disabledApp = (0, index_1.CoreSaaS)({
                db: { provider: 'sqlite' },
                adapter: 'fastify',
                jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' },
                audit: {
                    enabled: false,
                    batchSize: 1, // Disable batching for tests
                    flushInterval: 0 // Immediate flushing
                }
            });
            // Create a test user for the audit log
            const user = await disabledApp.userService.createUser({
                email: 'test-user-disabled@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const before = await db_client_1.db.auditLog.count();
            await disabledApp.auditService.log({
                action: 'test.event',
                success: true,
                actorId: user.id
            });
            const after = await db_client_1.db.auditLog.count();
            (0, vitest_1.expect)(after).toBe(before);
            await disabledApp.shutdown();
        });
    });
    (0, vitest_1.describe)('audit service methods', () => {
        (0, vitest_1.it)('logs permission checks', async () => {
            // Create test user and context
            const user = await app.userService.createUser({
                email: 'test-user-perm@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const context = await app.contextService.createContext({
                id: 'test-context',
                type: 'team',
                name: 'Test Context',
                context: { actorId: 'system' }
            });
            const before = await db_client_1.db.auditLog.count();
            await app.auditService.logPermissionCheck(user.id, context.id, 'test:permission', true);
            const after = await db_client_1.db.auditLog.count();
            (0, vitest_1.expect)(after).toBe(before + 1);
            const log = await db_client_1.db.auditLog.findFirst({
                where: { action: 'permission.check' },
                orderBy: { createdAt: 'desc' }
            });
            (0, vitest_1.expect)(log).toBeDefined();
            (0, vitest_1.expect)(log?.actorId).toBe(user.id);
            (0, vitest_1.expect)(log?.contextId).toBe(context.id);
            (0, vitest_1.expect)(log?.success).toBe(true);
        });
        (0, vitest_1.it)('logs user actions', async () => {
            // Create test users
            const adminUser = await app.userService.createUser({
                email: 'admin-user@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const targetUser = await app.userService.createUser({
                email: 'target-user@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const before = await db_client_1.db.auditLog.count();
            await app.auditService.logUserAction(adminUser.id, targetUser.id, 'user.updated', true);
            const after = await db_client_1.db.auditLog.count();
            (0, vitest_1.expect)(after).toBe(before + 1);
            const log = await db_client_1.db.auditLog.findFirst({
                where: { action: 'user.updated' },
                orderBy: { createdAt: 'desc' }
            });
            (0, vitest_1.expect)(log).toBeDefined();
            (0, vitest_1.expect)(log?.actorId).toBe(adminUser.id);
            (0, vitest_1.expect)(log?.targetUserId).toBe(targetUser.id);
            (0, vitest_1.expect)(log?.success).toBe(true);
        });
        (0, vitest_1.it)('logs token operations', async () => {
            // Create test user
            const user = await app.userService.createUser({
                email: 'test-user-token@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const before = await db_client_1.db.auditLog.count();
            await app.auditService.logTokenIssued(user.id, 'access');
            await app.auditService.logTokenRevoked(user.id, 'refresh');
            const after = await db_client_1.db.auditLog.count();
            (0, vitest_1.expect)(after).toBe(before + 2);
        });
        (0, vitest_1.it)('redacts sensitive data', async () => {
            // Create test user
            const user = await app.userService.createUser({
                email: 'test-user-sensitive@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            await app.auditService.log({
                action: 'test.sensitive',
                success: true,
                actorId: user.id,
                metadata: {
                    password: 'secret123',
                    token: 'jwt-token',
                    secret: 'api-key'
                }
            });
            const log = await db_client_1.db.auditLog.findFirst({
                where: { action: 'test.sensitive' },
                orderBy: { createdAt: 'desc' }
            });
            (0, vitest_1.expect)(log).toBeDefined();
            (0, vitest_1.expect)(log?.metadata).toEqual({
                password: '[REDACTED]',
                token: '[REDACTED]',
                secret: '[REDACTED]'
            });
        });
    });
    (0, vitest_1.describe)('audit querying', () => {
        (0, vitest_1.it)('retrieves audit logs with filtering', async () => {
            // Create test user and context
            const user = await app.userService.createUser({
                email: 'user1@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const context = await app.contextService.createContext({
                id: 'ctx1',
                type: 'team',
                name: 'Context 1',
                context: { actorId: 'system' }
            });
            // Create some audit logs
            await app.auditService.log({
                action: 'test.action1',
                success: true,
                actorId: user.id,
                contextId: context.id
            });
            await app.auditService.log({
                action: 'test.action2',
                success: true,
                actorId: user.id,
                contextId: context.id
            });
            const result = await app.auditService.getAuditLogs({
                actorId: user.id,
                contextId: context.id
            });
            (0, vitest_1.expect)(result.logs.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(result.logs.every((log) => log.actorId === user.id)).toBe(true);
            (0, vitest_1.expect)(result.logs.every((log) => log.contextId === context.id)).toBe(true);
        });
    });
});
