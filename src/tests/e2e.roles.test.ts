import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CoreSaaS } from '../index';
import { registerRoleRoutes } from '../core/http/api/roles';
import { defaultRoutePermissionPolicy } from '../core/policy/policy';

describe('E2E: Role Management', () => {
  let app: ReturnType<typeof CoreSaaS>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    app = CoreSaaS({ 
      db: { provider: 'sqlite' }, 
      adapter: 'fastify', 
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }
    });
    registerRoleRoutes(app, defaultRoutePermissionPolicy);
  });

  afterAll(async () => {
    await app.shutdown();
  });

  describe('role management permissions', () => {
    it('enforces type-specific permission for role management', async () => {
      const f = app.fastify!;

      // No auth -> 401
      const r1 = await f.inject({ 
        method: 'POST', 
        url: '/roles', 
        payload: { name: 'editor', contextType: 'team' } 
      });
      expect(r1.statusCode).toBe(401);

      // Wrong context type permission not enough
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'roles:org:create',
        context: { actorId: 'system' }
      });
      
      const r2 = await f.inject({ 
        method: 'POST', 
        url: '/roles', 
        payload: { name: 'editor', contextType: 'team' },
        headers: { 'x-user-id': 'u1' }
      });
      expect(r2.statusCode).toBe(403);

      // Correct context type permission works
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'roles:team:create',
        context: { actorId: 'system' }
      });
      
      const r3 = await f.inject({ 
        method: 'POST', 
        url: '/roles', 
        payload: { name: 'editor', contextType: 'team' },
        headers: { 'x-user-id': 'u1' }
      });
      expect(r3.statusCode).toBe(200);
    });

    it('enforces exact scope for role assignments', async () => {
      const f = app.fastify!;

      // Missing context type -> 403
      const r1 = await f.inject({ 
        method: 'POST', 
        url: '/roles/assign', 
        payload: { roleName: 'editor', userId: 'u2', contextId: 'ctx_1' },
        headers: { 'x-user-id': 'u1' }
      });
      expect(r1.statusCode).toBe(403);

      // Global permission not enough, needs exact context
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'roles:assign',
        context: { actorId: 'system' }
      });
      
      const r2 = await f.inject({ 
        method: 'POST', 
        url: '/roles/assign', 
        payload: { roleName: 'editor', userId: 'u2', contextId: 'ctx_1', contextType: 'team' },
        headers: { 'x-user-id': 'u1' }
      });
      expect(r2.statusCode).toBe(403);

      // Context-specific permission works
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'roles:assign',
        contextId: 'ctx_1',
        context: { actorId: 'system' }
      });
      
      const r3 = await f.inject({ 
        method: 'POST', 
        url: '/roles/assign', 
        payload: { roleName: 'editor', userId: 'u2', contextId: 'ctx_1', contextType: 'team' },
        headers: { 'x-user-id': 'u1' }
      });
      expect(r3.statusCode).toBe(200);
    });

    it('requires both role management and permission grant abilities', async () => {
      const f = app.fastify!;

      // Only role management permission not enough
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'roles:team:manage',
        context: { actorId: 'system' }
      });
      
      const r1 = await f.inject({ 
        method: 'POST', 
        url: '/roles/editor/permissions/add', 
        payload: { permissionKey: 'example:read', contextType: 'team' },
        headers: { 'x-user-id': 'u1' }
      });
      expect(r1.statusCode).toBe(403);

      // Only permission grant ability not enough
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'permissions:example:read:grant:team',
        context: { actorId: 'system' }
      });
      
      const r2 = await f.inject({ 
        method: 'POST', 
        url: '/roles/editor/permissions/add', 
        payload: { permissionKey: 'example:read', contextType: 'team' },
        headers: { 'x-user-id': 'u1' }
      });
      expect(r2.statusCode).toBe(403);

      // Both permissions work
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'roles:team:manage',
        context: { actorId: 'system' }
      });
      
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'permissions:example:read:grant:team',
        context: { actorId: 'system' }
      });
      
      const r3 = await f.inject({ 
        method: 'POST', 
        url: '/roles/editor/permissions/add', 
        payload: { permissionKey: 'example:read', contextType: 'team' },
        headers: { 'x-user-id': 'u1' }
      });
      expect(r3.statusCode).toBe(200);
    });

    it('validates role-permission grant inputs', async () => {
      const f = app.fastify!;

      // Grant global permission for the test
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'roles:permissions:grant',
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
        headers: { 'x-user-id': 'u1' }
      });
      expect(r1.statusCode).toBe(403);
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
        headers: { 'x-user-id': 'u1' }
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
        headers: { 'x-user-id': 'u1' }
      });
      expect(r3.statusCode).toBe(200);
    });
  });

  describe('role CRUD operations', () => {
    it('creates roles with proper validation', async () => {
      const f = app.fastify!;

      // Grant permission
      await app.permissionService.grantToUser({
        userId: 'admin',
        permissionKey: 'roles:team:create',
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
        headers: { 'x-user-id': 'admin' }
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
        headers: { 'x-user-id': 'admin' }
      });
      
      expect(listRes.statusCode).toBe(200);
      const roles = listRes.json() as any[];
      expect(roles.some(r => r.name === 'test-role')).toBe(true);

      // Cleanup
      await app.roleService.deleteRole('test-role', { actorId: 'system' });
    });

    it('handles role assignments and removals', async () => {
      const f = app.fastify!;

      // Create test user and role
      const user = await app.userService.createUser({
        email: 'role-test@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      await app.roleService.createRole({
        name: 'test-assignment-role',
        contextType: 'team',
        context: { actorId: 'system' }
      });

      // Grant permissions
      await app.permissionService.grantToUser({
        userId: 'admin',
        permissionKey: 'roles:assign',
        contextId: 'ctx_1',
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
        headers: { 'x-user-id': 'admin' }
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
        headers: { 'x-user-id': 'admin' }
      });
      
      expect(removeRes.statusCode).toBe(200);

      // Cleanup
      await app.userService.deleteUser(user.id, { actorId: 'system' });
      await app.roleService.deleteRole('test-assignment-role', { actorId: 'system' });
    });
  });
});


