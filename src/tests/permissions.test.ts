import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CoreSaaS } from '../index';
import { db } from '../core/db/db-client';

describe('Permission System', () => {
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
    
    // Initialize permission registry
    await app.permissionRegistry.initFromDatabase();
    await app.permissionRegistry.syncToDatabase();
  });

  afterAll(async () => {
    await app.shutdown();
  });

  describe('permission registry', () => {
    it('registers and retrieves permissions', () => {
      const permission = {
        key: 'test:permission',
        label: 'Test Permission',
        plugin: 'test'
      };

      app.permissionRegistry.register(permission);
      expect(app.permissionRegistry.has('test:permission')).toBe(true);
      expect(app.permissionRegistry.get('test:permission')).toEqual(permission);
    });

    it('handles duplicate registrations', () => {
      const permission = {
        key: 'duplicate:test',
        label: 'Duplicate Test',
        plugin: 'test'
      };

      app.permissionRegistry.register(permission);
      app.permissionRegistry.register(permission); // Should not throw
      expect(app.permissionRegistry.has('duplicate:test')).toBe(true);
    });

    it('syncs permissions to database', async () => {
      const permission = {
        key: 'db:sync:test',
        label: 'Database Sync Test',
        plugin: 'test'
      };

      app.permissionRegistry.register(permission);
      await app.permissionRegistry.syncToDatabase();

      const dbPermission = await db.permission.findUnique({
        where: { key: 'db:sync:test' }
      });

      expect(dbPermission).toBeDefined();
      expect(dbPermission?.key).toBe('db:sync:test');
      expect(dbPermission?.label).toBe('Database Sync Test');
    });

    it('initializes from database', async () => {
      // Create permission directly in database
      const timestamp = Date.now();
      const permissionKey = `db:init:test-${timestamp}`;
      
      await db.permission.create({
        data: {
          key: permissionKey,
          label: 'Database Init Test',
          plugin: 'test'
        }
      });

      // Clear registry and reinitialize
      app.permissionRegistry.clear();
      await app.permissionRegistry.initFromDatabase();

      expect(app.permissionRegistry.has(permissionKey)).toBe(true);
    });
  });

  describe('effective permissions', () => {
    it('merges user and role permissions (global)', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: `effective-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Create test permission
      const permission = await db.permission.upsert({
        where: { key: 'effective:test' },
        update: { label: 'Effective Test' },
        create: {
          key: 'effective:test',
          label: 'Effective Test'
        }
      });

      // Grant direct permission to user
      await db.userPermission.create({
        data: {
          id: `${user.id}-${permission.id}-global`,
          userId: user.id,
          permissionId: permission.id,
          contextId: null,
          contextType: null
        }
      });

      // Check effective permission
      const hasPermission = await app.checkAccess({ 
        userId: user.id, 
        permission: 'effective:test' 
      });
      expect(hasPermission).toBe(true);

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles context-specific permissions', async () => {
      const user = await app.userService.createUser({
        email: `context-perm-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      const context = await app.contextService.createContext({
        id: `perm-context-${Date.now()}`,
        type: 'organization',
        name: 'Permission Context',
        context: { actorId: 'system' }
      });

      const permission = await db.permission.upsert({
        where: { key: 'context:specific' },
        update: { label: 'Context Specific' },
        create: {
          key: 'context:specific',
          label: 'Context Specific'
        }
      });

      // Grant context-specific permission
      await db.userPermission.create({
        data: {
          id: `${user.id}-${permission.id}-${context.id}`,
          userId: user.id,
          permissionId: permission.id,
          contextId: context.id,
          contextType: null
        }
      });

      // Check permission in correct context
      const hasPermission = await app.checkAccess({ 
        userId: user.id, 
        permission: 'context:specific',
        context: { id: context.id, type: 'organization' }
      });
      expect(hasPermission).toBe(true);

      // Check permission in wrong context
      const hasNoPermission = await app.checkAccess({ 
        userId: user.id, 
        permission: 'context:specific',
        context: { id: 'wrong-context', type: 'organization' }
      });
      expect(hasNoPermission).toBe(false);

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles type-wide permissions', async () => {
      const user = await app.userService.createUser({
        email: `typewide-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      const permission = await db.permission.upsert({
        where: { key: 'type:wide' },
        update: { label: 'Type Wide' },
        create: {
          key: 'type:wide',
          label: 'Type Wide'
        }
      });

      // Grant type-wide permission
      await db.userPermission.create({
        data: {
          id: `${user.id}-${permission.id}-typewide`,
          userId: user.id,
          permissionId: permission.id,
          contextId: null,
          contextType: 'organization'
        }
      });

      // Check permission for any organization context
      const hasPermission = await app.checkAccess({ 
        userId: user.id, 
        permission: 'type:wide',
        context: { id: 'any-org', type: 'organization' }
      });
      expect(hasPermission).toBe(true);

      // Check permission for different type
      const hasNoPermission = await app.checkAccess({ 
        userId: user.id, 
        permission: 'type:wide',
        context: { id: 'any-team', type: 'team' }
      });
      expect(hasNoPermission).toBe(false);

      // No manual cleanup needed - beforeEach handles it
    });
  });

  describe('permission service', () => {
    it('grants and revokes user permissions', async () => {
      const user = await app.userService.createUser({
        email: `grant-revoke-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      const context = await app.contextService.createContext({
        id: `grant-context-${Date.now()}`,
        type: 'organization',
        name: 'Grant Context',
        context: { actorId: 'system' }
      });

      // Grant permission
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'grant:test',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      // Check permission is granted
      const hasPermission = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'grant:test',
        contextId: context.id,
        context: { actorId: 'system' }
      });
      expect(hasPermission).toBe(true);

      // Revoke permission
      await app.permissionService.revokeFromUser({
        userId: user.id,
        permissionKey: 'grant:test',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      // Check permission is revoked
      const hasNoPermission = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'grant:test',
        contextId: context.id,
        context: { actorId: 'system' }
      });
      expect(hasNoPermission).toBe(false);

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles bulk permission grants', async () => {
      const user = await app.userService.createUser({
        email: `bulk-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      const context = await app.contextService.createContext({
        id: `bulk-context-${Date.now()}`,
        type: 'organization',
        name: 'Bulk Context',
        context: { actorId: 'system' }
      });

      // Grant multiple permissions
      await app.permissionService.bulkGrantToUser({
        userId: user.id,
        permissions: [
          { permissionKey: 'bulk:read', contextId: context.id },
          { permissionKey: 'bulk:write', contextId: context.id },
          { permissionKey: 'bulk:delete', contextId: context.id }
        ],
        context: { actorId: 'system' }
      });

      // Check all permissions are granted
      const canRead = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'bulk:read',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      const canWrite = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'bulk:write',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      const canDelete = await app.permissionService.checkUserPermission({
        userId: user.id,
        permissionKey: 'bulk:delete',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      expect(canRead).toBe(true);
      expect(canWrite).toBe(true);
      expect(canDelete).toBe(true);

      // No manual cleanup needed - beforeEach handles it
    });

    it('gets user effective permissions', async () => {
      const user = await app.userService.createUser({
        email: `effective-perm-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      const context = await app.contextService.createContext({
        id: `effective-context-${Date.now()}`,
        type: 'organization',
        name: 'Effective Context',
        context: { actorId: 'system' }
      });

      // Grant direct permission
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'effective:direct',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      // Create role and assign permission
      const role = await app.roleService.createRole({
        name: 'effective-role',
        contextType: 'organization',
        context: { actorId: 'system' }
      });

      await app.roleService.addPermissionToRole({
        roleName: 'effective-role',
        permissionKey: 'effective:role',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      await app.roleService.assignRoleToUser({
        roleName: 'effective-role',
        userId: user.id,
        contextId: context.id,
        contextType: 'organization',
        context: { actorId: 'system' }
      });

      // Get effective permissions
      const effectivePermissions = await app.permissionService.getUserEffectivePermissions({
        userId: user.id,
        contextId: context.id,
        context: { actorId: 'system' }
      });

      expect(effectivePermissions.length).toBeGreaterThanOrEqual(2);
      expect(effectivePermissions.some(p => p.key === 'effective:direct')).toBe(true);
      expect(effectivePermissions.some(p => p.key === 'effective:role')).toBe(true);

      // No manual cleanup needed - beforeEach handles it
    });
  });

  describe('wildcard permissions', () => {
    it('handles wildcard permission matching', () => {
      const wildcardPermission = 'users:*';
      
      // Test exact matches
      expect(app.permissionRegistry.isAllowed('users:read', new Set([wildcardPermission]))).toBe(true);
      expect(app.permissionRegistry.isAllowed('users:write', new Set([wildcardPermission]))).toBe(true);
      expect(app.permissionRegistry.isAllowed('users:delete', new Set([wildcardPermission]))).toBe(true);

      // Test non-matches
      expect(app.permissionRegistry.isAllowed('projects:read', new Set([wildcardPermission]))).toBe(false);
      expect(app.permissionRegistry.isAllowed('admin:users:read', new Set([wildcardPermission]))).toBe(false);
    });

    it('handles nested wildcards', () => {
      const nestedWildcard = 'org:123:*';
      
      expect(app.permissionRegistry.isAllowed('org:123:read', new Set([nestedWildcard]))).toBe(true);
      expect(app.permissionRegistry.isAllowed('org:123:write', new Set([nestedWildcard]))).toBe(true);
      expect(app.permissionRegistry.isAllowed('org:456:read', new Set([nestedWildcard]))).toBe(false);
    });
  });
});


