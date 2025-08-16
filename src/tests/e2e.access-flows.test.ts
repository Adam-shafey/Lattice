import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CoreSaaS } from '../index';
import { db } from '../core/db/db-client';
import { requireAuthMiddleware } from '../core/http/api/auth';

describe('E2E: Access Flows', () => {
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
    await db.auditLog.deleteMany();
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

    // Initialize auth routes for testing
    const { createAuthRoutes } = await import('../core/http/api/auth');
    createAuthRoutes(app);
  });

  afterAll(async () => {
    if (app) {
      await app.shutdown();
    }
  });

  describe('context-scoped access', () => {
    it('role in context grants access only within that context; user grant works for another context', async () => {
      const f = app.fastify!;

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
      expect(r1.statusCode).toBe(200);
      
      // Access ctx_2 denied
      const r2 = await f.inject({ 
        method: 'GET', 
        url: '/read/ctx_2', 
        headers: { 'x-user-id': user.id, 'x-context-type': 'team' } 
      });
      expect(r2.statusCode).toBe(403);

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
      expect(r3.statusCode).toBe(200);

      // No manual cleanup needed - beforeEach handles it
    });

    it('validates context type matches when assigning roles', async () => {
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
      await expect(
        app.roleService.assignRoleToUser({ 
          roleName: 'member', 
          userId: user.id, 
          contextId: 'team_1', 
          contextType: 'team',
          context: { actorId: 'system' }
        })
      ).rejects.toThrow('Role \'member\' has type \'org\', cannot be assigned in \'team\' context');

      // Assigning with correct type should work
      await expect(
        app.roleService.assignRoleToUser({ 
          roleName: 'member', 
          userId: user.id, 
          contextId: 'org_1', 
          contextType: 'org',
          context: { actorId: 'system' }
        })
      ).resolves.toBeDefined();

      // No manual cleanup needed - beforeEach handles it
    });
  });

  describe('bearer token + authorize chain', () => {
    it('bearer token + authorize chain allows when token valid and permission present', async () => {
      const f = app.fastify!;

      // Protected route requiring bearer + permission
      app.route({
        method: 'GET',
        path: '/bear/:contextId',
        preHandler: [
          requireAuthMiddleware(app),
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
      const { accessToken } = login.json() as any;

      const okRes = await f.inject({ 
        method: 'GET', 
        url: '/bear/ctx_any', 
        headers: { authorization: `Bearer ${accessToken}` } 
      });
      expect(okRes.statusCode).toBe(200);

      // No manual cleanup needed - beforeEach handles it
    });
  });

  describe('permission inheritance', () => {
    it('global permissions work in any context', async () => {
      const f = app.fastify!;

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
      expect(res1.statusCode).toBe(200);

      const res2 = await f.inject({ 
        method: 'GET', 
        url: '/global/ctx_b', 
        headers: { 'x-user-id': user.id, 'x-context-type': 'org' } 
      });
      expect(res2.statusCode).toBe(200);

      // No manual cleanup needed - beforeEach handles it
    });

    it('type-wide permissions work for all contexts of that type', async () => {
      const f = app.fastify!;

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
      expect(res1.statusCode).toBe(200);

      const res2 = await f.inject({ 
        method: 'GET', 
        url: '/typewide/team_2', 
        headers: { 'x-user-id': user.id, 'x-context-type': 'team' } 
      });
      expect(res2.statusCode).toBe(200);

      // Should not work in org context
      const res3 = await f.inject({ 
        method: 'GET', 
        url: '/typewide/org_1', 
        headers: { 'x-user-id': user.id, 'x-context-type': 'org' } 
      });
      expect(res3.statusCode).toBe(403);

      // No manual cleanup needed - beforeEach handles it
    });
  });
});


