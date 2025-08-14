import { describe, it, expect } from 'vitest';
import { CoreSaaS } from '../index';

describe('E2E: protected routes via authorize()', () => {
  // Test: Basic exact scope - verifies that context-specific permissions work only in their context
  // Edge case: Ensures global permissions also work for exact scope routes
  it('requires x-user-id and permission with exact scope', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
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
    const r2 = await app.fastify!.inject({ method: 'GET', url: '/protected/ctx_1', headers: { 'x-user-id': 'u1', 'x-context-type': 'team' } });
    expect(r2.statusCode).toBe(403);
    // Grant and allow in exact context
    app.grantUserPermission('u1', 'example:*', 'ctx_1');
    const r3 = await app.fastify!.inject({ method: 'GET', url: '/protected/ctx_1', headers: { 'x-user-id': 'u1', 'x-context-type': 'team' } });
    expect(r3.statusCode).toBe(200);
  });

  // Test: Global scope - verifies that only global permissions work for global-scoped routes
  // Edge case: Ensures context-specific permissions are not enough, even with matching context
  it('enforces global scope requirement', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    // Protected with global scope
    app.route({
      method: 'GET',
      path: '/global',
      preHandler: app.authorize('admin:users:create', { scope: 'global' }),
      handler: async () => ({ ok: true }),
    });
    // Context-specific permission not enough
    app.grantUserPermission('u2', 'admin:users:create', 'ctx_1');
    const r1 = await app.fastify!.inject({ method: 'GET', url: '/global', headers: { 'x-user-id': 'u2' } });
    expect(r1.statusCode).toBe(403);
    // Global permission works
    app.grantUserPermission('u2', 'admin:users:create');
    const r2 = await app.fastify!.inject({ method: 'GET', url: '/global', headers: { 'x-user-id': 'u2' } });
    expect(r2.statusCode).toBe(200);
  });

  // Test: Type-wide scope - verifies that type-wide operations require context type and global permission
  // Edge case: Ensures context-specific permissions are not enough, even with matching type
  it('enforces type-wide scope requirement', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    // Protected with type-wide scope
    app.route({
      method: 'GET',
      path: '/type-wide',
      preHandler: app.authorize('team:settings:read', { scope: 'type-wide' }),
      handler: async () => ({ ok: true }),
    });
    // Missing context type -> 400
    const r1 = await app.fastify!.inject({ method: 'GET', url: '/type-wide', headers: { 'x-user-id': 'u3' } });
    expect(r1.statusCode).toBe(400);
    // Context-specific permission not enough
    app.grantUserPermission('u3', 'team:settings:read', 'team_1');
    const r2 = await app.fastify!.inject({ method: 'GET', url: '/type-wide', headers: { 'x-user-id': 'u3', 'x-context-type': 'team' } });
    expect(r2.statusCode).toBe(403);
    // Global permission works
    app.grantUserPermission('u3', 'team:settings:read');
    const r3 = await app.fastify!.inject({ method: 'GET', url: '/type-wide', headers: { 'x-user-id': 'u3', 'x-context-type': 'team' } });
    expect(r3.statusCode).toBe(200);
  });

  // Test: Mixed scopes - verifies that a route chain with different scope requirements works correctly
  // Edge case: Tests that all scope requirements must be met when multiple authorize middlewares are used
  it('handles mixed scope requirements in middleware chain', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    
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
    app.grantUserPermission('u4', 'admin:manage'); // global
    app.grantUserPermission('u4', 'context:write', 'ctx_1'); // exact

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
    app.grantUserPermission('u6', 'admin:manage');
    const r3 = await app.fastify!.inject({ 
      method: 'POST', 
      url: '/mixed/ctx_1', 
      headers: { 'x-user-id': 'u6', 'x-context-type': 'team' }
    });
    expect(r3.statusCode).toBe(403);
  });
});


