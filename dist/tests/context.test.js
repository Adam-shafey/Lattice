"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("../index");
const db_client_1 = require("../core/db/db-client");
(0, vitest_1.describe)('Context Service', () => {
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
    });
    (0, vitest_1.afterAll)(async () => {
        if (app) {
            await app.shutdown();
        }
    });
    (0, vitest_1.describe)('context resolution', () => {
        (0, vitest_1.it)('prefers route param over header and query', () => {
            const ctx = app.contextService.resolveContext({
                routeParam: 'route_ctx',
                header: 'hdr_ctx',
                query: 'qry_ctx'
            });
            (0, vitest_1.expect)(ctx?.id).toBe('route_ctx');
        });
        (0, vitest_1.it)('falls back to header then query', () => {
            const ctx = app.contextService.resolveContext({
                routeParam: null,
                header: 'hdr_ctx',
                query: 'qry_ctx'
            });
            (0, vitest_1.expect)(ctx?.id).toBe('hdr_ctx');
        });
        (0, vitest_1.it)('returns null when none provided', () => {
            const ctx = app.contextService.resolveContext({});
            (0, vitest_1.expect)(ctx).toBeNull();
        });
        (0, vitest_1.it)('handles empty strings', () => {
            const ctx = app.contextService.resolveContext({
                routeParam: '',
                header: '',
                query: ''
            });
            (0, vitest_1.expect)(ctx).toBeNull();
        });
    });
    (0, vitest_1.describe)('context management', () => {
        (0, vitest_1.it)('creates and retrieves contexts', async () => {
            const context = await app.contextService.createContext({
                id: 'test-org-1',
                type: 'organization',
                name: 'Test Organization',
                context: { actorId: 'system' }
            });
            (0, vitest_1.expect)(context.id).toBe('test-org-1');
            (0, vitest_1.expect)(context.type).toBe('organization');
            (0, vitest_1.expect)(context.name).toBe('Test Organization');
            const retrieved = await app.contextService.getContext('test-org-1');
            (0, vitest_1.expect)(retrieved).toBeDefined();
            (0, vitest_1.expect)(retrieved?.id).toBe('test-org-1');
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('updates context properties', async () => {
            const context = await app.contextService.createContext({
                id: 'test-org-2',
                type: 'organization',
                name: 'Original Name',
                context: { actorId: 'system' }
            });
            const updated = await app.contextService.updateContext('test-org-2', {
                name: 'Updated Name',
                type: 'team'
            }, { actorId: 'system' });
            (0, vitest_1.expect)(updated.name).toBe('Updated Name');
            (0, vitest_1.expect)(updated.type).toBe('team');
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('lists contexts with filtering', async () => {
            // Create test contexts
            await app.contextService.createContext({
                id: 'org-1',
                type: 'organization',
                name: 'Org 1',
                context: { actorId: 'system' }
            });
            await app.contextService.createContext({
                id: 'org-2',
                type: 'organization',
                name: 'Org 2',
                context: { actorId: 'system' }
            });
            await app.contextService.createContext({
                id: 'team-1',
                type: 'team',
                name: 'Team 1',
                context: { actorId: 'system' }
            });
            // List all contexts
            const allContexts = await app.contextService.listContexts({
                context: { actorId: 'system' }
            });
            (0, vitest_1.expect)(allContexts.contexts.length).toBeGreaterThanOrEqual(3);
            // List only organizations
            const orgContexts = await app.contextService.listContexts({
                type: 'organization',
                context: { actorId: 'system' }
            });
            (0, vitest_1.expect)(orgContexts.contexts.every(ctx => ctx.type === 'organization')).toBe(true);
            // List with pagination
            const paginatedContexts = await app.contextService.listContexts({
                limit: 2,
                offset: 0,
                context: { actorId: 'system' }
            });
            (0, vitest_1.expect)(paginatedContexts.contexts.length).toBeLessThanOrEqual(2);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('deletes contexts', async () => {
            const context = await app.contextService.createContext({
                id: 'test-org-3',
                type: 'organization',
                name: 'To Delete',
                context: { actorId: 'system' }
            });
            await app.contextService.deleteContext('test-org-3', { actorId: 'system' });
            const deleted = await app.contextService.getContext('test-org-3');
            (0, vitest_1.expect)(deleted).toBeNull();
        });
    });
    (0, vitest_1.describe)('context membership', () => {
        (0, vitest_1.it)('manages user membership in contexts', async () => {
            const user = await app.userService.createUser({
                email: 'context-test@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const context = await app.contextService.createContext({
                id: 'membership-test',
                type: 'organization',
                name: 'Membership Test Org',
                context: { actorId: 'system' }
            });
            // Add user to context
            await app.contextService.addUserToContext({
                userId: user.id,
                contextId: context.id,
                context: { actorId: 'system' }
            });
            // Get context users
            const users = await app.contextService.getContextUsers({
                contextId: context.id,
                context: { actorId: 'system' }
            });
            (0, vitest_1.expect)(users.length).toBe(1);
            (0, vitest_1.expect)(users[0].id).toBe(user.id);
            // Remove user from context
            await app.contextService.removeUserFromContext({
                userId: user.id,
                contextId: context.id,
                context: { actorId: 'system' }
            });
            const usersAfterRemoval = await app.contextService.getContextUsers({
                contextId: context.id,
                context: { actorId: 'system' }
            });
            (0, vitest_1.expect)(usersAfterRemoval.length).toBe(0);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('handles multiple users in context', async () => {
            const user1 = await app.userService.createUser({
                email: 'context-user1@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const user2 = await app.userService.createUser({
                email: 'context-user2@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const context = await app.contextService.createContext({
                id: 'multi-user-test',
                type: 'organization',
                name: 'Multi User Test Org',
                context: { actorId: 'system' }
            });
            // Add both users
            await app.contextService.addUserToContext({
                userId: user1.id,
                contextId: context.id,
                context: { actorId: 'system' }
            });
            await app.contextService.addUserToContext({
                userId: user2.id,
                contextId: context.id,
                context: { actorId: 'system' }
            });
            const users = await app.contextService.getContextUsers({
                contextId: context.id,
                context: { actorId: 'system' }
            });
            (0, vitest_1.expect)(users.length).toBe(2);
            (0, vitest_1.expect)(users.map(u => u.id).sort()).toEqual([user1.id, user2.id].sort());
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('removal is idempotent and targeted', async () => {
            const user1 = await app.userService.createUser({
                email: 'idempotent-user1@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const user2 = await app.userService.createUser({
                email: 'idempotent-user2@example.com',
                password: 'password123',
                context: { actorId: 'system' }
            });
            const context = await app.contextService.createContext({
                id: 'idempotent-test',
                type: 'organization',
                name: 'Idempotent Test Org',
                context: { actorId: 'system' }
            });
            // Add both users
            await app.contextService.addUserToContext({
                userId: user1.id,
                contextId: context.id,
                context: { actorId: 'system' }
            });
            await app.contextService.addUserToContext({
                userId: user2.id,
                contextId: context.id,
                context: { actorId: 'system' }
            });
            // Remove first user twice
            await app.contextService.removeUserFromContext({
                userId: user1.id,
                contextId: context.id,
                context: { actorId: 'system' }
            });
            await app.contextService.removeUserFromContext({
                userId: user1.id,
                contextId: context.id,
                context: { actorId: 'system' }
            });
            const remainingUsers = await app.contextService.getContextUsers({
                contextId: context.id,
                context: { actorId: 'system' }
            });
            (0, vitest_1.expect)(remainingUsers.length).toBe(1);
            (0, vitest_1.expect)(remainingUsers[0].id).toBe(user2.id);
            // No manual cleanup needed - beforeEach handles it
        });
    });
    (0, vitest_1.describe)('error handling', () => {
        (0, vitest_1.it)('handles non-existent contexts', async () => {
            const context = await app.contextService.getContext('non-existent');
            (0, vitest_1.expect)(context).toBeNull();
        });
        (0, vitest_1.it)('handles duplicate context creation', async () => {
            const contextId = 'duplicate-test';
            await app.contextService.createContext({
                id: contextId,
                type: 'organization',
                name: 'Duplicate Test',
                context: { actorId: 'system' }
            });
            await (0, vitest_1.expect)(app.contextService.createContext({
                id: contextId,
                type: 'organization',
                name: 'Duplicate Test 2',
                context: { actorId: 'system' }
            })).rejects.toThrow();
            // No manual cleanup needed - beforeEach handles it
        });
    });
});
