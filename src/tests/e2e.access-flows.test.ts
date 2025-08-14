import { describe, it, expect, beforeAll } from 'vitest';
import { CoreSaaS } from '../index';
import { PrismaClient } from '@prisma/client';
import { RoleService } from '../core/services/role-service';
import { createAuthRoutes, requireAuthMiddleware } from '../core/http/api/auth';
import { defaultRoutePermissionPolicy } from '../core/policy/policy';

describe('E2E: access flows (roles, permissions, contexts, bearer)', () => {
  const db = new PrismaClient() as PrismaClient & {
    user: { create: any; delete: any };
    context: { create: any };
    permission: { upsert: any; findUniqueOrThrow: any };
    userPermission: { create: any };
  };
  let app: ReturnType<typeof CoreSaaS>;
  let roleService: RoleService;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    roleService = new RoleService(app);
  });



  // Test: Context-scoped access - verifies that role and user permissions are properly scoped to contexts
  // Edge case: Tests that permissions from different sources (roles vs direct) work independently in different contexts
  it('role in context grants access only within that context; user grant works for another context', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    const f = app.fastify!;

    // Protected routes (pass type via header)
    app.route({ method: 'GET', path: '/read/:contextId', preHandler: app.authorize('example:read', { contextRequired: true }), handler: async () => ({ ok: true }) });
    app.route({ method: 'GET', path: '/write/:contextId', preHandler: app.authorize('example:write', { contextRequired: true }), handler: async () => ({ ok: true }) });

    const userId = `u_${Date.now()}`;
    // Create user in DB so role assignment has FK
    await db.user.create({ data: { id: userId, email: `${userId}@example.com`, passwordHash: 'x' } });

    // Ensure contexts exist for FK
    await db.context.create({ data: { id: 'ctx_1', type: 'team' } }).catch(() => {});
    await db.context.create({ data: { id: 'ctx_2', type: 'team' } }).catch(() => {});

    // Create role with read permission, assign to ctx_1 only
    await roleService.createRole('viewer', { contextType: 'team' });
    await roleService.addPermissionToRole({ 
      roleName: 'viewer', 
      permissionKey: 'example:read',
      contextType: 'team',
      policy: defaultRoutePermissionPolicy
    });
    await roleService.assignRoleToUser({ 
      roleName: 'viewer', 
      userId, 
      contextId: 'ctx_1', 
      contextType: 'team' 
    });

    // Access ctx_1 allowed
    const r1 = await f.inject({ method: 'GET', url: '/read/ctx_1', headers: { 'x-user-id': userId, 'x-context-type': 'team' } });
    expect(r1.statusCode).toBe(200);
    // Access ctx_2 denied
    const r2 = await f.inject({ method: 'GET', url: '/read/ctx_2', headers: { 'x-user-id': userId, 'x-context-type': 'team' } });
    expect(r2.statusCode).toBe(403);

    // Grant user-level write permission in ctx_2
    await db.permission.upsert({ where: { key: 'example:write' }, update: {}, create: { key: 'example:write', label: 'Write example' } });
    const perm = await db.permission.findUniqueOrThrow({ where: { key: 'example:write' } });
    await db.userPermission.create({ data: { id: `${userId}-${perm.id}-ctx_2`, userId, permissionId: perm.id, contextId: 'ctx_2' } });
    // Now write on ctx_2 should pass
    const r3 = await f.inject({ method: 'GET', url: '/write/ctx_2', headers: { 'x-user-id': userId, 'x-context-type': 'team' } });
    expect(r3.statusCode).toBe(200);
  });

  // Test: Context type validation - verifies that role assignments validate context type matches
  // Edge case: Tests that mismatched context types are rejected, even if the context exists
  it('validates context type matches when assigning roles', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    const userId = `u_${Date.now()}`;
    await db.user.create({ data: { id: userId, email: `${userId}@example.com`, passwordHash: 'x' } });

    // Create contexts of different types
    await db.context.create({ data: { id: 'team_1', type: 'team' } }).catch(() => {});
    await db.context.create({ data: { id: 'org_1', type: 'org' } }).catch(() => {});

    // Create role with wrong type
    await roleService.createRole('member', { contextType: 'org' });

    // Assigning org role to team context should fail
    await expect(
      roleService.assignRoleToUser({ roleName: 'member', userId, contextId: 'team_1', contextType: 'team' })
    ).rejects.toThrow('Role member has type org, cannot be assigned in team context');

    // Assigning with correct type should work
    await expect(
      roleService.assignRoleToUser({ roleName: 'member', userId, contextId: 'org_1', contextType: 'org' })
    ).resolves.toBeDefined();
  });

  // Test: Bearer token + authorize chain - verifies that token auth and permission checks work together
  // Edge case: Tests that global permissions work with bearer token auth
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
    const user = await db.user.create({ data: { email, passwordHash: await (await import('bcryptjs')).default.hash('secret1', 10) } });

    // Prepare permission via role (global)
    await roleService.createRole('viewer2', { contextType: 'global' });
    await roleService.addPermissionToRole({ 
      roleName: 'viewer2', 
      permissionKey: 'example:read',
      contextType: 'global',
      policy: defaultRoutePermissionPolicy
    });
    await roleService.assignRoleToUser({ 
      roleName: 'viewer2', 
      userId: user.id, 
      contextId: null,
      contextType: 'global'
    });

    // Login to get tokens
    const login = await f.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'secret1' } });
    const { accessToken } = login.json() as any;

    const okRes = await f.inject({ method: 'GET', url: '/bear/ctx_any', headers: { authorization: `Bearer ${accessToken}` } });
    expect(okRes.statusCode).toBe(200);
  });


});


