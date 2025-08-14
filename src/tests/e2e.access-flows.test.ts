import { describe, it, expect, beforeAll } from 'vitest';
import { CoreSaaS } from '../index';
import { PrismaClient } from '@prisma/client';
import { RoleService } from '../core/roles/role-service';
import { createAuthRoutes, requireAuthMiddleware } from '../core/auth/routes';

describe('E2E: access flows (roles, permissions, contexts, bearer)', () => {
  const db = new PrismaClient();
  const roleService = new RoleService();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  });

  it('role in context grants access only within that context; user grant works for another context', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    const f = app.fastify!;

    // Protected routes
    app.route({ method: 'GET', path: '/read/:contextId', preHandler: app.authorize('example:read', { contextRequired: true }), handler: async () => ({ ok: true }) });
    app.route({ method: 'GET', path: '/write/:contextId', preHandler: app.authorize('example:write', { contextRequired: true }), handler: async () => ({ ok: true }) });

    const userId = `u_${Date.now()}`;
    // Create user in DB so role assignment has FK
    await db.user.create({ data: { id: userId, email: `${userId}@example.com`, passwordHash: 'x' } });

    // Ensure contexts exist for FK
    await db.context.create({ data: { id: 'ctx_1', type: 'team' } }).catch(() => {});
    await db.context.create({ data: { id: 'ctx_2', type: 'team' } }).catch(() => {});

    // Create role with read permission, assign to ctx_1 only
    await roleService.createRole('viewer');
    await roleService.addPermissionToRole({ roleName: 'viewer', permissionKey: 'example:read' });
    await roleService.assignRoleToUser({ roleName: 'viewer', userId, contextId: 'ctx_1' });

    // Access ctx_1 allowed
    const r1 = await f.inject({ method: 'GET', url: '/read/ctx_1', headers: { 'x-user-id': userId } });
    expect(r1.statusCode).toBe(200);
    // Access ctx_2 denied
    const r2 = await f.inject({ method: 'GET', url: '/read/ctx_2', headers: { 'x-user-id': userId } });
    expect(r2.statusCode).toBe(403);

    // Grant user-level write permission in ctx_2
    await db.permission.upsert({ where: { key: 'example:write' }, update: {}, create: { key: 'example:write', label: 'Write example' } });
    const perm = await db.permission.findUniqueOrThrow({ where: { key: 'example:write' } });
    await db.userPermission.create({ data: { id: `${userId}-${perm.id}-ctx_2`, userId, permissionId: perm.id, contextId: 'ctx_2' } });
    // Now write on ctx_2 should pass
    const r3 = await f.inject({ method: 'GET', url: '/write/ctx_2', headers: { 'x-user-id': userId } });
    expect(r3.statusCode).toBe(200);
  });

  it('bearer token + authorize chain allows when token valid and permission present', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    createAuthRoutes(app);
    const f = app.fastify!;

    // Protected route requiring bearer + permission
    app.route({
      method: 'GET',
      path: '/bear/:contextId',
      preHandler: [requireAuthMiddleware(), app.authorize('example:read', { contextRequired: true })],
      handler: async () => ({ ok: true }),
    });

    const email = `b_${Date.now()}@example.com`;
    const user = await db.user.create({ data: { email, passwordHash: await (await import('bcryptjs')).default.hash('pw', 10) } });

    // Prepare permission via role (global)
    await roleService.createRole('viewer2');
    await roleService.addPermissionToRole({ roleName: 'viewer2', permissionKey: 'example:read' });
    await roleService.assignRoleToUser({ roleName: 'viewer2', userId: user.id, contextId: null });

    // Login to get tokens
    const login = await f.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'pw' } });
    const { accessToken } = login.json() as any;

    const okRes = await f.inject({ method: 'GET', url: '/bear/ctx_any', headers: { authorization: `Bearer ${accessToken}` } });
    expect(okRes.statusCode).toBe(200);
  });
});


