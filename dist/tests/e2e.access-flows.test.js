"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("../index");
const db_client_1 = require("../core/db/db-client");
const auth_1 = require("../core/http/api/auth");
(0, vitest_1.describe)('E2E: Access Flows', () => {
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
        const { createAuthRoutes } = await Promise.resolve().then(() => __importStar(require('../core/http/api/auth')));
        createAuthRoutes(app);
    });
    (0, vitest_1.afterAll)(async () => {
        if (app) {
            await app.shutdown();
        }
    });
    (0, vitest_1.describe)('context-scoped access', () => {
        (0, vitest_1.it)('role in context grants access only within that context; user grant works for another context', async () => {
            const f = app.fastify;
            // Protected routes (pass type via header)
            app.route({
                method: 'GET',
                path: '/read/:contextId',
                preHandler: app.authorize('example:read', { contextRequired: true }),
                handler: async () => ({ ok: true })
            });
            app.route({
                method: 'GET',
                path: '/write/:contextId',
                preHandler: app.authorize('example:write', { contextRequired: true }),
                handler: async () => ({ ok: true })
            });
            const userId = `u_${Date.now()}`;
            // Create user through service
            const user = await app.userService.createUser({
                email: `${userId}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Create contexts through service
            await app.contextService.createContext({
                id: 'ctx_1',
                type: 'team',
                name: 'Context 1',
                context: { actorId: 'system' }
            });
            await app.contextService.createContext({
                id: 'ctx_2',
                type: 'team',
                name: 'Context 2',
                context: { actorId: 'system' }
            });
            // Create role with read permission, assign to ctx_1 only
            await app.roleService.createRole({
                name: 'viewer',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            await app.roleService.addPermissionToRole({
                roleName: 'viewer',
                permissionKey: 'example:read',
                contextId: 'ctx_1',
                context: { actorId: 'system' }
            });
            await app.roleService.assignRoleToUser({
                roleName: 'viewer',
                userId: user.id,
                contextId: 'ctx_1',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // Access ctx_1 allowed
            const r1 = await f.inject({
                method: 'GET',
                url: '/read/ctx_1',
                headers: { 'x-user-id': user.id, 'x-context-type': 'team' }
            });
            (0, vitest_1.expect)(r1.statusCode).toBe(200);
            // Access ctx_2 denied
            const r2 = await f.inject({
                method: 'GET',
                url: '/read/ctx_2',
                headers: { 'x-user-id': user.id, 'x-context-type': 'team' }
            });
            (0, vitest_1.expect)(r2.statusCode).toBe(403);
            // Grant user-level write permission in ctx_2
            await app.permissionService.grantToUser({
                userId: user.id,
                permissionKey: 'example:write',
                contextId: 'ctx_2',
                context: { actorId: 'system' }
            });
            // Now write on ctx_2 should pass
            const r3 = await f.inject({
                method: 'GET',
                url: '/write/ctx_2',
                headers: { 'x-user-id': user.id, 'x-context-type': 'team' }
            });
            (0, vitest_1.expect)(r3.statusCode).toBe(200);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('validates context type matches when assigning roles', async () => {
            const userId = `u_${Date.now()}`;
            // Create user through service
            const user = await app.userService.createUser({
                email: `${userId}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Create contexts of different types
            await app.contextService.createContext({
                id: 'team_1',
                type: 'team',
                name: 'Team 1',
                context: { actorId: 'system' }
            });
            await app.contextService.createContext({
                id: 'org_1',
                type: 'org',
                name: 'Org 1',
                context: { actorId: 'system' }
            });
            // Create role with wrong type
            await app.roleService.createRole({
                name: 'member',
                contextType: 'org',
                context: { actorId: 'system' }
            });
            // Assigning org role to team context should fail
            await (0, vitest_1.expect)(app.roleService.assignRoleToUser({
                roleName: 'member',
                userId: user.id,
                contextId: 'team_1',
                contextType: 'team',
                context: { actorId: 'system' }
            })).rejects.toThrow('Role \'member\' has type \'org\', cannot be assigned in \'team\' context');
            // Assigning with correct type should work
            await (0, vitest_1.expect)(app.roleService.assignRoleToUser({
                roleName: 'member',
                userId: user.id,
                contextId: 'org_1',
                contextType: 'org',
                context: { actorId: 'system' }
            })).resolves.toBeDefined();
            // No manual cleanup needed - beforeEach handles it
        });
    });
    (0, vitest_1.describe)('bearer token + authorize chain', () => {
        (0, vitest_1.it)('bearer token + authorize chain allows when token valid and permission present', async () => {
            const f = app.fastify;
            // Protected route requiring bearer + permission
            app.route({
                method: 'GET',
                path: '/bear/:contextId',
                preHandler: [
                    (0, auth_1.requireAuthMiddleware)(app),
                    app.authorize('example:read', { contextRequired: true })
                ],
                handler: async () => ({ ok: true }),
            });
            const email = `b_${Date.now()}@example.com`;
            // Create user through service
            const user = await app.userService.createUser({
                email,
                password: 'secretpassword123',
                context: { actorId: 'system' }
            });
            // Prepare permission via role (global)
            await app.roleService.createRole({
                name: 'viewer2',
                contextType: 'global',
                context: { actorId: 'system' }
            });
            await app.roleService.addPermissionToRole({
                roleName: 'viewer2',
                permissionKey: 'example:read',
                contextId: null,
                contextType: 'global',
                context: { actorId: 'system' }
            });
            await app.roleService.assignRoleToUser({
                roleName: 'viewer2',
                userId: user.id,
                contextId: null,
                contextType: 'global',
                context: { actorId: 'system' }
            });
            // Login to get tokens
            const login = await f.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { email, password: 'secretpassword123' }
            });
            const { accessToken } = login.json();
            const okRes = await f.inject({
                method: 'GET',
                url: '/bear/ctx_any',
                headers: { authorization: `Bearer ${accessToken}` }
            });
            (0, vitest_1.expect)(okRes.statusCode).toBe(200);
            // No manual cleanup needed - beforeEach handles it
        });
    });
    (0, vitest_1.describe)('permission inheritance', () => {
        (0, vitest_1.it)('global permissions work in any context', async () => {
            const f = app.fastify;
            app.route({
                method: 'GET',
                path: '/global/:contextId',
                preHandler: app.authorize('global:read', { contextRequired: true }),
                handler: async () => ({ ok: true }),
            });
            const user = await app.userService.createUser({
                email: `global_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Grant global permission
            await app.permissionService.grantToUser({
                userId: user.id,
                permissionKey: 'global:read',
                context: { actorId: 'system' }
            });
            // Create multiple contexts
            await app.contextService.createContext({
                id: 'ctx_a',
                type: 'team',
                name: 'Context A',
                context: { actorId: 'system' }
            });
            await app.contextService.createContext({
                id: 'ctx_b',
                type: 'org',
                name: 'Context B',
                context: { actorId: 'system' }
            });
            // Should work in any context
            const res1 = await f.inject({
                method: 'GET',
                url: '/global/ctx_a',
                headers: { 'x-user-id': user.id, 'x-context-type': 'team' }
            });
            (0, vitest_1.expect)(res1.statusCode).toBe(200);
            const res2 = await f.inject({
                method: 'GET',
                url: '/global/ctx_b',
                headers: { 'x-user-id': user.id, 'x-context-type': 'org' }
            });
            (0, vitest_1.expect)(res2.statusCode).toBe(200);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('type-wide permissions work for all contexts of that type', async () => {
            const f = app.fastify;
            app.route({
                method: 'GET',
                path: '/typewide/:contextId',
                preHandler: app.authorize('team:read', { contextRequired: true }),
                handler: async () => ({ ok: true }),
            });
            const user = await app.userService.createUser({
                email: `typewide_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Grant type-wide permission
            await app.permissionService.grantToUser({
                userId: user.id,
                permissionKey: 'team:read',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // Create multiple team contexts
            await app.contextService.createContext({
                id: 'team_1',
                type: 'team',
                name: 'Team 1',
                context: { actorId: 'system' }
            });
            await app.contextService.createContext({
                id: 'team_2',
                type: 'team',
                name: 'Team 2',
                context: { actorId: 'system' }
            });
            await app.contextService.createContext({
                id: 'org_1',
                type: 'org',
                name: 'Org 1',
                context: { actorId: 'system' }
            });
            // Should work in any team context
            const res1 = await f.inject({
                method: 'GET',
                url: '/typewide/team_1',
                headers: { 'x-user-id': user.id, 'x-context-type': 'team' }
            });
            (0, vitest_1.expect)(res1.statusCode).toBe(200);
            const res2 = await f.inject({
                method: 'GET',
                url: '/typewide/team_2',
                headers: { 'x-user-id': user.id, 'x-context-type': 'team' }
            });
            (0, vitest_1.expect)(res2.statusCode).toBe(200);
            // Should not work in org context
            const res3 = await f.inject({
                method: 'GET',
                url: '/typewide/org_1',
                headers: { 'x-user-id': user.id, 'x-context-type': 'org' }
            });
            (0, vitest_1.expect)(res3.statusCode).toBe(403);
            // No manual cleanup needed - beforeEach handles it
        });
    });
});
