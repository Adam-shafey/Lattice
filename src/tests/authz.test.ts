import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Lattice } from '../index';
import { db } from '../core/db/db-client';

describe('Authorization Middleware', () => {
  let app: ReturnType<typeof Lattice>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  });

    beforeEach(async () => {
    // Create fresh app instance for each test
    app = Lattice({ 
      db: { provider: 'sqlite' }, 
      adapter: 'fastify',
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }
    });
    
    // Clean up database before each test - delete child records first
    await db.userPermission.deleteMany();
    await db.rolePermission.deleteMany();
    await db.userRole.deleteMany();
    await db.userContext.deleteMany();
    await db.passwordResetToken.deleteMany();
    await db.revokedToken.deleteMany();
    await db.user.deleteMany();
    await db.context.deleteMany();
    await db.role.deleteMany();
    await db.permission.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.shutdown();
    }
  });

  describe('basic authorization', () => {
    it('exposes authorize() without throwing', () => {
      const mw = app.authorize('example:read', { contextRequired: true });
      expect(typeof mw).toBe('function');
    });

    it('creates middleware with different scopes', () => {
      const exactMw = app.authorize('example:read', { scope: 'exact', contextRequired: true });
      const globalMw = app.authorize('example:read', { scope: 'global' });
      const typeWideMw = app.authorize('example:read', { scope: 'type-wide' });

      expect(typeof exactMw).toBe('function');
      expect(typeof globalMw).toBe('function');
      expect(typeof typeWideMw).toBe('function');
    });
  });

  describe('permission checking', () => {
    it('checks user permissions correctly', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: 'authz-test@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Create test context
      const context = await app.contextService.createContext({
        id: 'test-context',
        type: 'organization',
        name: 'Test Org',
        context: { actorId: 'system' }
      });

      // Grant permission to user
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'test:read',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      // Check permission
      const hasPermission = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'test:read',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      expect(hasPermission).toBe(true);

      // Check non-existent permission
      const hasNoPermission = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'test:write',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      expect(hasNoPermission).toBe(false);

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles global permissions', async () => {
      const user = await app.userService.createUser({
        email: 'global-test@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Grant global permission
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'system:admin',
        context: { actorId: 'system' }
      });

      // Check global permission
      const hasGlobalPermission = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'system:admin',
        context: { actorId: 'system' }
      });

      expect(hasGlobalPermission).toBe(true);

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles type-wide permissions', async () => {
      const user = await app.userService.createUser({
        email: 'typewide-test@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Grant type-wide permission
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'org:manage',
        contextType: 'organization',
        context: { actorId: 'system' }
      });

      // Check type-wide permission
      const hasTypeWidePermission = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'org:manage',
        contextType: 'organization',
        context: { actorId: 'system' }
      });

      expect(hasTypeWidePermission).toBe(true);

      // No manual cleanup needed - beforeEach handles it
    });

    it('denies access without permission', async () => {
      const user = await app.userService.createUser({
        email: 'no-perm@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      app.permissionRegistry.register({
        key: 'some:perm',
        label: 'Some Permission',
        plugin: 'test'
      });

      app.route({
        method: 'GET',
        path: '/no-access',
        handler: async () => ({ ok: true }),
        preHandler: app.authorize('some:perm')
      });

      const response = await app.fastify!.inject({
        method: 'GET',
        url: '/no-access',
        headers: { 'x-user-id': user.id }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('role-based permissions', () => {
    it('checks role-based permissions', async () => {
      const user = await app.userService.createUser({
        email: 'role-test@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      const context = await app.contextService.createContext({
        id: 'role-context',
        type: 'organization',
        name: 'Role Test Org',
        context: { actorId: 'system' }
      });

      // Create role
      const role = await app.roleService.createRole({
        name: 'viewer',
        contextType: 'organization',
        context: { actorId: 'system' }
      });

      // Add permission to role
      await app.roleService.addPermissionToRole({
        roleName: 'viewer',
        permissionKey: 'content:read',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      // Assign role to user
      await app.roleService.assignRoleToUser({
        roleName: 'viewer',
        userId: user.id,
        contextId: context.id,
        contextType: 'organization',
        context: { actorId: 'system' }
      });

      // Check role-based permission
      const hasRolePermission = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'content:read',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      expect(hasRolePermission).toBe(true);

      // No manual cleanup needed - beforeEach handles it
    });
  });

  describe('wildcard permissions', () => {
    it('handles wildcard permissions', async () => {
      const user = await app.userService.createUser({
        email: 'wildcard-test@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      const context = await app.contextService.createContext({
        id: 'wildcard-context',
        type: 'organization',
        name: 'Wildcard Test Org',
        context: { actorId: 'system' }
      });

      // Grant wildcard permission
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'content:*',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      // Check specific permissions covered by wildcard
      const canRead = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'content:read',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      const canWrite = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'content:write',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      const canDelete = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'content:delete',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      expect(canRead).toBe(true);
      expect(canWrite).toBe(true);
      expect(canDelete).toBe(true);

      // Check permission not covered by wildcard
      const canManage = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'user:manage',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      expect(canManage).toBe(false);

      // No manual cleanup needed - beforeEach handles it
    });
  });
});


