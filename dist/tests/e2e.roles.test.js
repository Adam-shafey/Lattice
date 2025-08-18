"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("../index");
const roles_1 = require("../core/http/api/roles");
const db_client_1 = require("../core/db/db-client");
const logger_1 = require("../core/logger");
const jwt_1 = require("../core/auth/jwt");
const jwt = (0, jwt_1.createJwtUtil)({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' }, db_client_1.db);
function authHeaders(userId) {
    const token = jwt.signAccess({ sub: userId });
    return { authorization: `Bearer ${token}`, 'x-user-id': userId };
}
(0, vitest_1.describe)('E2E: Role Management', () => {
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
        (0, roles_1.registerRoleRoutes)(app);
        // Clean up database before each test - delete child records first
        await db_client_1.db.$transaction([
            db_client_1.db.userPermission.deleteMany(),
            db_client_1.db.rolePermission.deleteMany(),
            db_client_1.db.userRole.deleteMany(),
            db_client_1.db.userContext.deleteMany(),
            db_client_1.db.passwordResetToken.deleteMany(),
            db_client_1.db.revokedToken.deleteMany(),
            db_client_1.db.user.deleteMany(),
            db_client_1.db.context.deleteMany(),
            db_client_1.db.role.deleteMany(),
            db_client_1.db.permission.deleteMany(),
        ]);
        // Register permissions used in tests
        app.permissionRegistry.register({ key: 'roles:assign:team', label: 'Assign Team Roles' });
        app.permissionRegistry.register({ key: 'roles:remove:team', label: 'Remove Team Roles' });
        app.permissionRegistry.register({ key: 'roles:team:manage', label: 'Manage Team Roles' });
        app.permissionRegistry.register({ key: 'roles:team:create', label: 'Create Team Roles' });
        app.permissionRegistry.register({ key: 'roles:team:list', label: 'List Team Roles' });
        app.permissionRegistry.register({ key: 'roles:list', label: 'List All Roles' });
        app.permissionRegistry.register({ key: 'permissions:example:read:grant:team', label: 'Grant Example Read Permission to Team' });
    });
    (0, vitest_1.afterAll)(async () => {
        await app.shutdown();
    });
    (0, vitest_1.describe)('role management permissions', () => {
        (0, vitest_1.it)('enforces type-specific permission for role management', async () => {
            const f = app.fastify;
            // Create test user
            const user = await app.userService.createUser({
                email: `role_test_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // No auth -> 401
            const r1 = await f.inject({
                method: 'POST',
                url: '/roles',
                payload: { name: 'editor', contextType: 'team' }
            });
            (0, vitest_1.expect)(r1.statusCode).toBe(401);
            // Wrong context type permission not enough
            await app.permissionService.grantToUser({
                userId: user.id,
                permissionKey: 'roles:org:create',
                context: { actorId: 'system' }
            });
            const r2 = await f.inject({
                method: 'POST',
                url: '/roles',
                payload: { name: 'editor', contextType: 'team' },
                headers: authHeaders(user.id)
            });
            (0, vitest_1.expect)(r2.statusCode).toBe(403);
            // Correct context type permission works
            await app.permissionService.grantToUser({
                userId: user.id,
                permissionKey: 'roles:team:create',
                context: { actorId: 'system' }
            });
            const r3 = await f.inject({
                method: 'POST',
                url: '/roles',
                payload: { name: 'editor', contextType: 'team' },
                headers: authHeaders(user.id)
            });
            (0, vitest_1.expect)(r3.statusCode).toBe(200);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('enforces exact scope for role assignments', async () => {
            const f = app.fastify;
            // Create test context
            const context = await app.contextService.createContext({
                id: 'ctx_1',
                type: 'team',
                name: 'Test Context',
                context: { actorId: 'system' }
            });
            // Create test users
            const user1 = await app.userService.createUser({
                email: `role_assign_1_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            const user2 = await app.userService.createUser({
                email: `role_assign_2_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Missing context type -> 403
            const r1 = await f.inject({
                method: 'POST',
                url: '/roles/assign',
                payload: { roleName: 'editor', userId: user2.id, contextId: 'ctx_1' },
                headers: authHeaders(user1.id)
            });
            (0, vitest_1.expect)(r1.statusCode).toBe(403);
            // Grant type-wide permission and assign
            await app.permissionService.grantToUser({
                userId: user1.id,
                permissionKey: 'roles:assign:team',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            const r2 = await f.inject({
                method: 'POST',
                url: '/roles/assign',
                payload: { roleName: 'editor', userId: user2.id, contextId: 'ctx_1', contextType: 'team' },
                headers: authHeaders(user1.id)
            });
            (0, vitest_1.expect)(r2.statusCode).toBe(200);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('requires both role management and permission grant abilities', async () => {
            const f = app.fastify;
            // Create the editor role first
            await app.roleService.createRole({
                name: 'editor',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // Create test user for first test
            const user1 = await app.userService.createUser({
                email: `role_manage_1_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Only role management permission not enough
            await app.permissionService.grantToUser({
                userId: user1.id,
                permissionKey: 'roles:team:manage',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // Debug: Check what permissions the user actually has
            const effectivePerms = await app.checkAccess({
                userId: user1.id,
                permission: 'roles:team:manage',
                scope: 'type-wide',
                contextType: 'team'
            });
            logger_1.logger.log('User1 has roles:team:manage:', effectivePerms);
            const effectivePerms2 = await app.checkAccess({
                userId: user1.id,
                permission: 'permissions:example:read:grant:team',
                scope: 'type-wide',
                contextType: 'team'
            });
            logger_1.logger.log('User1 has permissions:example:read:grant:team:', effectivePerms2);
            // Debug: Check what the route will be checking for
            const routePermission1 = 'roles:team:manage';
            const routePermission2 = 'permissions:example:read:grant:team';
            logger_1.logger.log('Route will check for:', { routePermission1, routePermission2 });
            // Debug: Check what permissions the user actually has
            const allPerms = await app.permissionService.getUserEffectivePermissions({
                userId: user1.id,
                contextType: 'team'
            });
            logger_1.logger.log('User1 all permissions:', allPerms.map(p => p.key));
            const r1 = await f.inject({
                method: 'POST',
                url: '/roles/editor/permissions/add',
                payload: { permissionKey: 'example:read', contextType: 'team' },
                headers: authHeaders(user1.id)
            });
            logger_1.logger.log('Response status:', r1.statusCode, 'Response body:', r1.json());
            (0, vitest_1.expect)(r1.statusCode).toBe(403);
            // Create new user for second test
            const user2 = await app.userService.createUser({
                email: `role_manage_2_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Only permission grant ability not enough
            await app.permissionService.grantToUser({
                userId: user2.id,
                permissionKey: 'permissions:example:read:grant:team',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            const r2 = await f.inject({
                method: 'POST',
                url: '/roles/editor/permissions/add',
                payload: { permissionKey: 'example:read', contextType: 'team' },
                headers: authHeaders(user2.id)
            });
            (0, vitest_1.expect)(r2.statusCode).toBe(403);
            // Create new user for third test
            const user3 = await app.userService.createUser({
                email: `role_manage_3_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Both permissions work
            await app.permissionService.grantToUser({
                userId: user3.id,
                permissionKey: 'roles:team:manage',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            await app.permissionService.grantToUser({
                userId: user3.id,
                permissionKey: 'permissions:example:read:grant:team',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            const r3 = await f.inject({
                method: 'POST',
                url: '/roles/editor/permissions/add',
                payload: { permissionKey: 'example:read', contextType: 'team' },
                headers: authHeaders(user3.id)
            });
            (0, vitest_1.expect)(r3.statusCode).toBe(200);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('validates role-permission grant inputs', async () => {
            const f = app.fastify;
            // Create test user
            const user = await app.userService.createUser({
                email: `role_validate_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Create the editor role first
            await app.roleService.createRole({
                name: 'editor',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // Grant both required permissions for the test
            await app.permissionService.grantToUser({
                userId: user.id,
                permissionKey: 'roles:team:manage',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            await app.permissionService.grantToUser({
                userId: user.id,
                permissionKey: 'permissions:example:read:grant:team',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // Cannot provide both contextId and contextType
            const r1 = await f.inject({
                method: 'POST',
                url: '/roles/editor/permissions/add',
                payload: {
                    permissionKey: 'example:read',
                    contextId: 'ctx_1',
                    contextType: 'team'
                },
                headers: authHeaders(user.id)
            });
            (0, vitest_1.expect)(r1.statusCode).toBe(400);
            (0, vitest_1.expect)(r1.json()).toMatchObject({
                error: 'Invalid input',
                issues: vitest_1.expect.arrayContaining([
                    vitest_1.expect.objectContaining({
                        message: 'Provide either contextId for exact, or contextType for type-wide, not both'
                    })
                ])
            });
            // Valid exact context grant
            const r2 = await f.inject({
                method: 'POST',
                url: '/roles/editor/permissions/add',
                payload: {
                    permissionKey: 'example:read',
                    contextId: 'ctx_1'
                },
                headers: authHeaders(user.id)
            });
            (0, vitest_1.expect)(r2.statusCode).toBe(200);
            // Valid type-wide grant
            const r3 = await f.inject({
                method: 'POST',
                url: '/roles/editor/permissions/add',
                payload: {
                    permissionKey: 'example:read',
                    contextType: 'team'
                },
                headers: authHeaders(user.id)
            });
            (0, vitest_1.expect)(r3.statusCode).toBe(200);
            // No manual cleanup needed - beforeEach handles it
        });
    });
    (0, vitest_1.describe)('role CRUD operations', () => {
        (0, vitest_1.it)('creates roles with proper validation', async () => {
            const f = app.fastify;
            // Create admin user
            const admin = await app.userService.createUser({
                email: `role_admin_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Grant permissions for both create and list operations
            await app.permissionService.grantToUser({
                userId: admin.id,
                permissionKey: 'roles:team:create',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // The list roles endpoint now requires a type-specific permission
            await app.permissionService.grantToUser({
                userId: admin.id,
                permissionKey: 'roles:team:list',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // Create role
            const createRes = await f.inject({
                method: 'POST',
                url: '/roles',
                payload: {
                    name: 'test-role',
                    contextType: 'team',
                    key: 'test-role-key'
                },
                headers: authHeaders(admin.id)
            });
            (0, vitest_1.expect)(createRes.statusCode).toBe(200);
            const role = createRes.json();
            (0, vitest_1.expect)(role.name).toBe('test-role');
            (0, vitest_1.expect)(role.contextType).toBe('team');
            (0, vitest_1.expect)(role.key).toBe('test-role-key');
            // List roles
            const listRes = await f.inject({
                method: 'GET',
                url: '/roles?contextType=team',
                headers: authHeaders(admin.id)
            });
            (0, vitest_1.expect)(listRes.statusCode).toBe(200);
            const roles = listRes.json();
            (0, vitest_1.expect)(roles.some(r => r.name === 'test-role')).toBe(true);
            // No manual cleanup needed - beforeEach handles it
        });
        (0, vitest_1.it)('handles role assignments and removals', async () => {
            const f = app.fastify;
            // Create test context
            const context = await app.contextService.createContext({
                id: 'ctx_1',
                type: 'team',
                name: 'Test Context',
                context: { actorId: 'system' }
            });
            // Create test user and role
            const user = await app.userService.createUser({
                email: `role-test-${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            await app.roleService.createRole({
                name: 'test-assignment-role',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // Create admin user
            const admin = await app.userService.createUser({
                email: `role_assign_admin_${Date.now()}@example.com`,
                password: 'password123',
                context: { actorId: 'system' }
            });
            // Grant permissions - role assignment now requires type-wide scope
            await app.permissionService.grantToUser({
                userId: admin.id,
                permissionKey: 'roles:assign:team',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            await app.permissionService.grantToUser({
                userId: admin.id,
                permissionKey: 'roles:remove:team',
                contextType: 'team',
                context: { actorId: 'system' }
            });
            // Assign role
            const assignRes = await f.inject({
                method: 'POST',
                url: '/roles/assign',
                payload: {
                    roleName: 'test-assignment-role',
                    userId: user.id,
                    contextId: 'ctx_1',
                    contextType: 'team'
                },
                headers: authHeaders(admin.id)
            });
            (0, vitest_1.expect)(assignRes.statusCode).toBe(200);
            // Remove role
            const removeRes = await f.inject({
                method: 'POST',
                url: '/roles/remove',
                payload: {
                    roleName: 'test-assignment-role',
                    userId: user.id,
                    contextId: 'ctx_1',
                    contextType: 'team'
                },
                headers: authHeaders(admin.id)
            });
            (0, vitest_1.expect)(removeRes.statusCode).toBe(200);
            // No manual cleanup needed - beforeEach handles it
        });
    });
});
