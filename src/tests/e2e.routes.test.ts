import { describe, it, expect } from 'vitest';
import { CoreSaaS } from '../index';

describe('E2E: protected routes via authorize()', () => {
  it('requires x-user-id and permission', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    // Protected
    app.route({
      method: 'GET',
      path: '/protected/:contextId',
      preHandler: app.authorize('example:read', { contextRequired: true }),
      handler: async () => ({ ok: true }),
    });
    // No header -> 401
    const r1 = await app.fastify!.inject({ method: 'GET', url: '/protected/ctx_1' });
    expect(r1.statusCode).toBe(401);
    // With user but no grants -> 403
    const r2 = await app.fastify!.inject({ method: 'GET', url: '/protected/ctx_1', headers: { 'x-user-id': 'u1' } });
    expect(r2.statusCode).toBe(403);
    // Grant and allow
    app.grantUserPermission('u1', 'example:*', 'ctx_1');
    const r3 = await app.fastify!.inject({ method: 'GET', url: '/protected/ctx_1', headers: { 'x-user-id': 'u1' } });
    expect(r3.statusCode).toBe(200);
  });
});


