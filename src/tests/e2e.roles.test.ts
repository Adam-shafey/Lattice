import { describe, it, expect } from 'vitest';
import { CoreSaaS } from '../index';
import { registerRoleRoutes } from '../core/http/api/roles';
import { defaultRoutePermissionPolicy } from '../core/policy/policy';

describe('E2E: roles API guards', () => {
  it('denies role operations without auth headers', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    registerRoleRoutes(app, defaultRoutePermissionPolicy);
    const f = app.fastify!;
    const res = await f.inject({ method: 'POST', url: '/roles', payload: { name: 'editor' } });
    expect(res.statusCode).toBe(401);
  });
});


