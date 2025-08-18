import { describe, it, expect, afterAll, beforeEach, afterEach } from 'vitest';
import { Lattice } from '../index';
import { db } from '../core/db/db-client';

describe('E2E: Protected Routes', () => {
  let app: ReturnType<typeof Lattice>;
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

  afterEach(async () => {
    // Clean up app instance after each test
    if (app) {
      await app.shutdown();
    }
  });

  afterAll(async () => {
    // Final cleanup - delete child records first
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

  describe('exact scope permissions', () => {
    it('requires x-user-id and permission with exact scope', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: `exact-scope-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Create test context
      const context = await app.contextService.createContext({
        id: `exact-context-${Date.now()}`,
        type: 'organization',
        name: 'Exact Scope Context',
        context: { actorId: 'system' }
      });

      // Create test permission
      const permission = await db.permission.upsert({
        where: { key: 'exact:scope:test' },
        update: { label: 'Exact Scope Test' },
        create: {
          key: 'exact:scope:test',
          label: 'Exact Scope Test'
        }
      });

      // Register permission in the registry
      app.permissionRegistry.register({
        key: 'exact:scope:test',
        label: 'Exact Scope Test',
        plugin: 'test'
      });

      // Grant permission to user in specific context
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'exact:scope:test',
        contextId: context.id,
        context: { actorId: 'system' }
      });

      // Add protected route
      app.route({
        method: 'GET',
        path: '/exact-scope-test',
        handler: async ({ user, context, body, params, query, req }) => {
          return { message: 'exact scope test passed' };
        },
        preHandler: app.authorize('exact:scope:test', { 
          scope: 'exact', 
          contextType: 'organization' 
        })
      });

      // Test with correct user and context
      const response = await app.fastify!.inject({
        method: 'GET',
        url: '/exact-scope-test',
        headers: {
          'x-user-id': user.id,
          'x-context-id': context.id,
          'x-context-type': 'organization'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ message: 'exact scope test passed' });
    });
  });

  describe('global scope permissions', () => {
    it('enforces global scope requirement', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: `global-scope-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Create test permission
      const permission = await db.permission.upsert({
        where: { key: 'global:scope:test' },
        update: { label: 'Global Scope Test' },
        create: {
          key: 'global:scope:test',
          label: 'Global Scope Test'
        }
      });

      // Register permission in the registry
      app.permissionRegistry.register({
        key: 'global:scope:test',
        label: 'Global Scope Test',
        plugin: 'test'
      });

      // Grant global permission to user
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'global:scope:test',
        context: { actorId: 'system' }
      });

      // Add protected route
      app.route({
        method: 'GET',
        path: '/global-scope-test',
        handler: async ({ user, context, body, params, query, req }) => {
          return { message: 'global scope test passed' };
        },
        preHandler: app.authorize('global:scope:test', { 
          scope: 'global' 
        })
      });

      // Test with correct user (no context needed for global)
      const response = await app.fastify!.inject({
        method: 'GET',
        url: '/global-scope-test',
        headers: {
          'x-user-id': user.id
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ message: 'global scope test passed' });
    });
  });

  describe('type-wide scope permissions', () => {
    it('enforces type-wide scope requirement', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: `typewide-scope-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Create test context
      const context = await app.contextService.createContext({
        id: `typewide-context-${Date.now()}`,
        type: 'organization',
        name: 'Type-wide Scope Context',
        context: { actorId: 'system' }
      });

      // Create test permission
      const permission = await db.permission.upsert({
        where: { key: 'typewide:scope:test' },
        update: { label: 'Type-wide Scope Test' },
        create: {
          key: 'typewide:scope:test',
          label: 'Type-wide Scope Test'
        }
      });

      // Register permission in the registry
      app.permissionRegistry.register({
        key: 'typewide:scope:test',
        label: 'Type-wide Scope Test',
        plugin: 'test'
      });

      // Grant type-wide permission to user
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'typewide:scope:test',
        context: { actorId: 'system' }
      });

      // Add protected route
      app.route({
        method: 'GET',
        path: '/typewide-scope-test',
        handler: async ({ user, context, body, params, query, req }) => {
          return { message: 'type-wide scope test passed' };
        },
        preHandler: app.authorize('typewide:scope:test', { 
          scope: 'type-wide', 
          contextType: 'organization' 
        })
      });

      // Test with correct user and context type
      const response = await app.fastify!.inject({
        method: 'GET',
        url: '/typewide-scope-test',
        headers: {
          'x-user-id': user.id,
          'x-context-id': context.id,
          'x-context-type': 'organization'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ message: 'type-wide scope test passed' });
    });
  });

  describe('mixed scope requirements', () => {
    it('handles global permission without context information', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: `mixed-scope-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Create test permission
      const permission = await db.permission.upsert({
        where: { key: 'mixed:global:test' },
        update: { label: 'Mixed Global Test' },
        create: {
          key: 'mixed:global:test',
          label: 'Mixed Global Test'
        }
      });

      // Register permission in the registry
      app.permissionRegistry.register({
        key: 'mixed:global:test',
        label: 'Mixed Global Test',
        plugin: 'test'
      });

      // Grant global permission
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'mixed:global:test',
        context: { actorId: 'system' }
      });

      // Add protected route that requires global permission
      app.route({
        method: 'GET',
        path: '/mixed-scope-test',
        handler: async ({ user, context, body, params, query, req }) => {
          return { message: 'mixed scope test passed' };
        },
        preHandler: app.authorize('mixed:global:test', { scope: 'global' })
      });

      // Test with correct user (global permission) - no context information
      const response = await app.fastify!.inject({
        method: 'GET',
        url: '/mixed-scope-test',
        headers: {
          'x-user-id': user.id
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ 
        message: 'mixed scope test passed'
      });
    });
  });

  describe('wildcard permissions', () => {
    it('handles wildcard permissions in routes', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: `wildcard-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Create test permission with wildcard
      const permission = await db.permission.upsert({
        where: { key: 'wildcard:users:*' },
        update: { label: 'Wildcard Users Test' },
        create: {
          key: 'wildcard:users:*',
          label: 'Wildcard Users Test'
        }
      });

      // Register permission in the registry
      app.permissionRegistry.register({
        key: 'wildcard:users:*',
        label: 'Wildcard Users Test',
        plugin: 'test'
      });

      // Grant wildcard permission to user
      await app.permissionService.grantToUser({
        userId: user.id,
        permissionKey: 'wildcard:users:*',
        context: { actorId: 'system' }
      });

      // Add protected route
      app.route({
        method: 'GET',
        path: '/wildcard-test',
        handler: async ({ user, context, body, params, query, req }) => {
          return { message: 'wildcard test passed' };
        },
        preHandler: app.authorize('wildcard:users:read', { 
          scope: 'global' 
        })
      });

      // Test with correct user
      const response = await app.fastify!.inject({
        method: 'GET',
        url: '/wildcard-test',
        headers: {
          'x-user-id': user.id
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ message: 'wildcard test passed' });
    });
  });

  describe('error handling', () => {
    it('handles invalid context types', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: `invalid-context-test-${Date.now()}@example.com`,
        password: 'password123',
        context: { actorId: 'system' }
      });

      // Register permission in the registry
      app.permissionRegistry.register({
        key: 'invalid:context:test',
        label: 'Invalid Context Test',
        plugin: 'test'
      });

      // Add protected route
      app.route({
        method: 'GET',
        path: '/invalid-context-test',
        handler: async ({ user, context, body, params, query, req }) => {
          return { message: 'should not reach here' };
        },
        preHandler: app.authorize('invalid:context:test', { 
          scope: 'exact', 
          contextType: 'invalid-type' 
        })
      });

      // Test with invalid context type
      const response = await app.fastify!.inject({
        method: 'GET',
        url: '/invalid-context-test',
        headers: {
          'x-user-id': user.id,
          'x-context-id': 'some-context',
          'x-context-type': 'invalid-type'
        }
      });

      expect(response.statusCode).toBe(403);
    });

    it('handles missing user ID', async () => {
      // Register permission in the registry
      app.permissionRegistry.register({
        key: 'missing:user:test',
        label: 'Missing User Test',
        plugin: 'test'
      });

      // Add protected route
      app.route({
        method: 'GET',
        path: '/missing-user-test',
        handler: async ({ user, context, body, params, query, req }) => {
          return { message: 'should not reach here' };
        },
        preHandler: app.authorize('missing:user:test', { 
          scope: 'global' 
        })
      });

      // Test without user ID
      const response = await app.fastify!.inject({
        method: 'GET',
        url: '/missing-user-test'
      });

      expect(response.statusCode).toBe(401);
    });
  });
});