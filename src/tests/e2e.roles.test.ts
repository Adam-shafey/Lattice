import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CoreSaaS } from '../index';
import { registerRoleRoutes } from '../core/http/api/roles';
import { defaultRoutePermissionPolicy } from '../core/policy/policy';
import { db } from '../core/db/db-client';
import { logger } from '../core/logger';

describe('E2E: Role Management', () => {
  let app: ReturnType<typeof CoreSaaS>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  });

  beforeEach(async () => {
    // Create fresh app instance for each test
    app = CoreSaaS({ 
      db: { provider: 'sqlite' }, 
      adapter: 'fastify',
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }
    });
    registerRoleRoutes(app, defaultRoutePermissionPolicy);
    
    // Clean up database before each test - delete child records first
    await db.$transaction([
      db.userPermission.deleteMany(),
      db.rolePermission.deleteMany(),
      db.userRole.deleteMany(),
      db.userContext.deleteMany(),
      db.passwordResetToken.deleteMany(),
      db.revokedToken.deleteMany(),
      db.user.deleteMany(),
      db.context.deleteMany(),
      db.role.deleteMany(),
      db.permission.deleteMany(),
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

  afterAll(async () => {
    await app.shutdown();
  });

  describe('role management permissions', () => {
    it('enforces type-specific permission for role management', async () => {
      const f = app.fastify!;

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
      expect(r1.statusCode).toBe(401);

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
        headers: { 'x-user-id': user.id }
      });
      expect(r2.statusCode).toBe(403);

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
        headers: { 'x-user-id': user.id }
      });
      expect(r3.statusCode).toBe(200);

      // No manual cleanup needed - beforeEach handles it
    });

    it('enforces exact scope for role assignments', async () => {
      const f = app.fastify!;

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
        headers: { 'x-user-id': user1.id }
      });
      expect(r1.statusCode).toBe(403);

      // Global permission not enough, needs type-wide context
      await app.permissionService.grantToUser({
        userId: user1.id,
        permissionKey: 'roles:assign',
        context: { actorId: 'system' }
      });
      
      const r2 = await f.inject({ 
        method: 'POST', 
        url: '/roles/assign', 
        payload: { roleName: 'editor', userId: user2.id, contextId: 'ctx_1', contextType: 'team' },
        headers: { 'x-user-id': user1.id }
      });
      expect(r2.statusCode).toBe(403);

      // Type-wide permission works
      await app.permissionService.grantToUser({
        userId: user1.id,
        permissionKey: 'roles:assign:team',
        contextType: 'team',
        context: { actorId: 'system' }
      });
      
      const r3 = await f.inject({ 
        method: 'POST', 
        url: '/roles/assign', 
        payload: { roleName: 'editor', userId: user2.id, contextId: 'ctx_1', contextType: 'team' },
        headers: { 'x-user-id': user1.id }
      });
      expect(r3.statusCode).toBe(200);

      // No manual cleanup needed - beforeEach handles it
    });

    it('requires both role management and permission grant abilities', async () => {
      const f = app.fastify!;

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
      logger.log('User1 has roles:team:manage:', effectivePerms);
      
      const effectivePerms2 = await app.checkAccess({
        userId: user1.id,
        permission: 'permissions:example:read:grant:team',
        scope: 'type-wide',
        contextType: 'team'
      });
      logger.log('User1 has permissions:example:read:grant:team:', effectivePerms2);
      
      // Debug: Check what the route will be checking for
      const routePermission1 = 'roles:team:manage';
      const routePermission2 = 'permissions:example:read:grant:team';
      logger.log('Route will check for:', { routePermission1, routePermission2 });
      
      // Debug: Check what permissions the user actually has
      const allPerms = await app.permissionService.getUserEffectivePermissions({
        userId: user1.id,
        contextType: 'team'
      });
      logger.log('User1 all permissions:', allPerms.map(p => p.key));
      
      const r1 = await f.inject({ 
        method: 'POST', 
        url: '/roles/editor/permissions/add', 
        payload: { permissionKey: 'example:read', contextType: 'team' },
        headers: { 'x-user-id': user1.id }
      });
      logger.log('Response status:', r1.statusCode, 'Response body:', r1.json());
      expect(r1.statusCode).toBe(403);

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
        headers: { 'x-user-id': user2.id }
      });
      expect(r2.statusCode).toBe(403);

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
        headers: { 'x-user-id': user3.id }
      });
      expect(r3.statusCode).toBe(200);

      // No manual cleanup needed - beforeEach handles it
    });

    it('validates role-permission grant inputs', async () => {
      const f = app.fastify!;

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
        headers: { 'x-user-id': user.id }
      });
      expect(r1.statusCode).toBe(400);
      expect(r1.json()).toMatchObject({ 
        error: 'Invalid input',
        issues: expect.arrayContaining([
          expect.objectContaining({
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
        headers: { 'x-user-id': user.id }
      });
      expect(r2.statusCode).toBe(200);

      // Valid type-wide grant
      const r3 = await f.inject({ 
        method: 'POST', 
        url: '/roles/editor/permissions/add', 
        payload: { 
          permissionKey: 'example:read', 
          contextType: 'team'
        },
        headers: { 'x-user-id': user.id }
      });
      expect(r3.statusCode).toBe(200);

      // No manual cleanup needed - beforeEach handles it
    });
  });

  describe('role CRUD operations', () => {
    it('creates roles with proper validation', async () => {
      const f = app.fastify!;

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
        headers: { 'x-user-id': admin.id }
      });
      
      expect(createRes.statusCode).toBe(200);
      const role = createRes.json() as any;
      expect(role.name).toBe('test-role');
      expect(role.contextType).toBe('team');
      expect(role.key).toBe('test-role-key');

      // List roles
      const listRes = await f.inject({ 
        method: 'GET', 
        url: '/roles?contextType=team',
        headers: { 'x-user-id': admin.id }
      });
      
      expect(listRes.statusCode).toBe(200);
      const roles = listRes.json() as any[];
      expect(roles.some(r => r.name === 'test-role')).toBe(true);

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles role assignments and removals', async () => {
      const f = app.fastify!;

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
        headers: { 'x-user-id': admin.id }
      });
      
      expect(assignRes.statusCode).toBe(200);

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
        headers: { 'x-user-id': admin.id }
      });
      
      expect(removeRes.statusCode).toBe(200);

      // No manual cleanup needed - beforeEach handles it
    });
  });
});


