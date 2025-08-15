import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CoreSaaS } from '../index';
import { db } from '../core/db/db-client';

describe('E2E: Protected Routes', () => {
  let app: ReturnType<typeof CoreSaaS>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    app = CoreSaaS({ 
      db: { provider: 'sqlite' }, 
      adapter: 'fastify', 
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }
    });
  });

  afterAll(async () => {
    await app.shutdown();
  });

  describe('exact scope permissions', () => {
    it('requires x-user-id and permission with exact scope', async () => {
      // Protected with exact scope
      app.route({
        method: 'GET',
        path: '/protected/:contextId',
        preHandler: app.authorize('example:read', { scope: 'exact', contextRequired: true }),
        handler: async () => ({ ok: true }),
      });
      
      // No header -> 401
      const r1 = await app.fastify!.inject({ method: 'GET', url: '/protected/ctx_1' });
      expect(r1.statusCode).toBe(401);
      
      // With user but no grants -> 403
      const r2 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/protected/ctx_1', 
        headers: { 'x-user-id': 'u1', 'x-context-type': 'team' } 
      });
      expect(r2.statusCode).toBe(403);
      
      // Grant and allow in exact context
      await app.permissionService.grantToUser({
        userId: 'u1',
        permissionKey: 'example:*',
        contextId: 'ctx_1',
        context: { actorId: 'system' }
      });
      
      const r3 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/protected/ctx_1', 
        headers: { 'x-user-id': 'u1', 'x-context-type': 'team' } 
      });
      expect(r3.statusCode).toBe(200);
    });
  });

  describe('global scope permissions', () => {
    it('enforces global scope requirement', async () => {
      // Protected with global scope
      app.route({
        method: 'GET',
        path: '/global',
        preHandler: app.authorize('admin:users:create', { scope: 'global' }),
        handler: async () => ({ ok: true }),
      });
      
      // Context-specific permission not enough
      await app.permissionService.grantToUser({
        userId: 'u2',
        permissionKey: 'admin:users:create',
        contextId: 'ctx_1',
        context: { actorId: 'system' }
      });
      
      const r1 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/global', 
        headers: { 'x-user-id': 'u2' } 
      });
      expect(r1.statusCode).toBe(403);
      
      // Global permission works
      await app.permissionService.grantToUser({
        userId: 'u2',
        permissionKey: 'admin:users:create',
        context: { actorId: 'system' }
      });
      
      const r2 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/global', 
        headers: { 'x-user-id': 'u2' } 
      });
      expect(r2.statusCode).toBe(200);
    });
  });

  describe('type-wide scope permissions', () => {
    it('enforces type-wide scope requirement', async () => {
      // Protected with type-wide scope
      app.route({
        method: 'GET',
        path: '/type-wide',
        preHandler: app.authorize('team:settings:read', { scope: 'type-wide' }),
        handler: async () => ({ ok: true }),
      });
      
      // Missing context type -> 400
      const r1 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/type-wide', 
        headers: { 'x-user-id': 'u3' } 
      });
      expect(r1.statusCode).toBe(400);
      
      // Context-specific permission not enough
      await app.permissionService.grantToUser({
        userId: 'u3',
        permissionKey: 'team:settings:read',
        contextId: 'team_1',
        context: { actorId: 'system' }
      });
      
      const r2 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/type-wide', 
        headers: { 'x-user-id': 'u3', 'x-context-type': 'team' } 
      });
      expect(r2.statusCode).toBe(403);
      
      // Global permission works
      await app.permissionService.grantToUser({
        userId: 'u3',
        permissionKey: 'team:settings:read',
        context: { actorId: 'system' }
      });
      
      const r3 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/type-wide', 
        headers: { 'x-user-id': 'u3', 'x-context-type': 'team' } 
      });
      expect(r3.statusCode).toBe(200);
    });
  });

  describe('mixed scope requirements', () => {
    it('handles mixed scope requirements in middleware chain', async () => {
      // Create test context
      await app.contextService.createContext({
        id: 'ctx_1',
        type: 'team',
        name: 'Test Team',
        context: { actorId: 'system' }
      });
      
      // Route with both global and exact scope requirements
      app.route({
        method: 'POST',
        path: '/mixed/:contextId',
        preHandler: [
          app.authorize('admin:manage', { scope: 'global' }),
          app.authorize('context:write', { scope: 'exact', contextRequired: true })
        ],
        handler: async () => ({ ok: true }),
      });

      // Setup permissions
      await app.permissionService.grantToUser({
        userId: 'u4',
        permissionKey: 'admin:manage',
        context: { actorId: 'system' }
      }); // global
      
      await app.permissionService.grantToUser({
        userId: 'u4',
        permissionKey: 'context:write',
        contextId: 'ctx_1',
        context: { actorId: 'system' }
      }); // exact

      // Both permissions present -> 200
      const r1 = await app.fastify!.inject({ 
        method: 'POST', 
        url: '/mixed/ctx_1', 
        headers: { 'x-user-id': 'u4', 'x-context-type': 'team' }
      });
      expect(r1.statusCode).toBe(200);

      // Missing global -> 403
      const r2 = await app.fastify!.inject({ 
        method: 'POST', 
        url: '/mixed/ctx_1', 
        headers: { 'x-user-id': 'u5', 'x-context-type': 'team' }
      });
      expect(r2.statusCode).toBe(403);

      // Missing exact -> 403
      await app.permissionService.grantToUser({
        userId: 'u6',
        permissionKey: 'admin:manage',
        context: { actorId: 'system' }
      });
      
      const r3 = await app.fastify!.inject({ 
        method: 'POST', 
        url: '/mixed/ctx_1', 
        headers: { 'x-user-id': 'u6', 'x-context-type': 'team' }
      });
      expect(r3.statusCode).toBe(403);

      // Cleanup
      await app.contextService.deleteContext('ctx_1', { actorId: 'system' });
    });
  });

  describe('wildcard permissions', () => {
    it('handles wildcard permissions in routes', async () => {
      app.route({
        method: 'GET',
        path: '/wildcard/:contextId',
        preHandler: app.authorize('content:*', { contextRequired: true }),
        handler: async () => ({ ok: true }),
      });

      // Create test context
      await app.contextService.createContext({
        id: 'wildcard-ctx',
        type: 'team',
        name: 'Wildcard Test',
        context: { actorId: 'system' }
      });

      // Grant wildcard permission
      await app.permissionService.grantToUser({
        userId: 'wildcard-user',
        permissionKey: 'content:*',
        contextId: 'wildcard-ctx',
        context: { actorId: 'system' }
      });

      // Should work with any content permission
      const r1 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/wildcard/wildcard-ctx', 
        headers: { 'x-user-id': 'wildcard-user', 'x-context-type': 'team' }
      });
      expect(r1.statusCode).toBe(200);

      // Cleanup
      await app.contextService.deleteContext('wildcard-ctx', { actorId: 'system' });
    });
  });

  describe('error handling', () => {
    it('handles invalid context types', async () => {
      app.route({
        method: 'GET',
        path: '/invalid-context/:contextId',
        preHandler: app.authorize('test:read', { contextRequired: true }),
        handler: async () => ({ ok: true }),
      });

      // Grant permission
      await app.permissionService.grantToUser({
        userId: 'test-user',
        permissionKey: 'test:read',
        contextId: 'ctx_1',
        context: { actorId: 'system' }
      });

      // Missing context type header
      const r1 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/invalid-context/ctx_1', 
        headers: { 'x-user-id': 'test-user' }
      });
      expect(r1.statusCode).toBe(400);

      // Invalid context type
      const r2 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/invalid-context/ctx_1', 
        headers: { 'x-user-id': 'test-user', 'x-context-type': 'invalid' }
      });
      expect(r2.statusCode).toBe(400);
    });

    it('handles missing user ID', async () => {
      app.route({
        method: 'GET',
        path: '/no-user/:contextId',
        preHandler: app.authorize('test:read', { contextRequired: true }),
        handler: async () => ({ ok: true }),
      });

      // Missing user ID
      const r1 = await app.fastify!.inject({ 
        method: 'GET', 
        url: '/no-user/ctx_1', 
        headers: { 'x-context-type': 'team' }
      });
      expect(r1.statusCode).toBe(401);
    });
  });
});