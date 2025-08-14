import { describe, it, expect } from 'vitest';
import { CoreSaaS } from '../index';
import { registerRoleRoutes } from '../core/http/api/roles';
import { defaultRoutePermissionPolicy } from '../core/policy/policy';

describe('E2E: roles API guards', () => {
  // Test: Role management - verifies that role CRUD operations require type-specific permission
  // Edge case: Ensures permissions are scoped to the correct context type
  it('enforces type-specific permission for role management', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    registerRoleRoutes(app, defaultRoutePermissionPolicy);
    const f = app.fastify!;

    // No auth -> 401
    const r1 = await f.inject({ 
      method: 'POST', 
      url: '/roles', 
      payload: { name: 'editor', contextType: 'team' } 
    });
    expect(r1.statusCode).toBe(401);

    // Wrong context type permission not enough
    app.grantUserPermission('u1', 'roles:org:create', 'org');
    const r2 = await f.inject({ 
      method: 'POST', 
      url: '/roles', 
      payload: { name: 'editor', contextType: 'team' },
      headers: { 'x-user-id': 'u1' }
    });
    expect(r2.statusCode).toBe(403);

    // Correct context type permission works
    app.grantUserPermission('u1', 'roles:team:create', 'team');
    const r3 = await f.inject({ 
      method: 'POST', 
      url: '/roles', 
      payload: { name: 'editor', contextType: 'team' },
      headers: { 'x-user-id': 'u1' }
    });
    expect(r3.statusCode).toBe(200);
  });

  // Test: Role assignments - verifies that role assignments require exact context scope
  // Edge case: Ensures global permissions are not enough for context-specific operations
  it('enforces exact scope for role assignments', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    registerRoleRoutes(app, defaultRoutePermissionPolicy);
    const f = app.fastify!;

    // Missing context type -> 400
    const r1 = await f.inject({ 
      method: 'POST', 
      url: '/roles/assign', 
      payload: { roleName: 'editor', userId: 'u2', contextId: 'ctx_1' },
      headers: { 'x-user-id': 'u1' }
    });
    expect(r1.statusCode).toBe(400);

    // Global permission not enough, needs exact context
    app.grantUserPermission('u1', 'roles:assign');
    const r2 = await f.inject({ 
      method: 'POST', 
      url: '/roles/assign', 
      payload: { roleName: 'editor', userId: 'u2', contextId: 'ctx_1', contextType: 'team' },
      headers: { 'x-user-id': 'u1' }
    });
    expect(r2.statusCode).toBe(403);

    // Context-specific permission works
    app.grantUserPermission('u1', 'roles:assign', 'ctx_1');
    const r3 = await f.inject({ 
      method: 'POST', 
      url: '/roles/assign', 
      payload: { roleName: 'editor', userId: 'u2', contextId: 'ctx_1', contextType: 'team' },
      headers: { 'x-user-id': 'u1' }
    });
    expect(r3.statusCode).toBe(200);
  });

  // Test: Role-permission grants - verifies that both role management and permission grant abilities are required
  // Edge case: Tests that having only one of the required permissions is not enough
  it('requires both role management and permission grant abilities', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    registerRoleRoutes(app, defaultRoutePermissionPolicy);
    const f = app.fastify!;

    // Only role management permission not enough
    app.grantUserPermission('u1', 'roles:team:manage', 'team');
    const r1 = await f.inject({ 
      method: 'POST', 
      url: '/roles/editor/permissions/add', 
      payload: { permissionKey: 'example:read', contextType: 'team' },
      headers: { 'x-user-id': 'u1' }
    });
    expect(r1.statusCode).toBe(403);

    // Only permission grant ability not enough
    app.grantUserPermission('u1', 'permissions:example:read:grant:team', 'team');
    const r2 = await f.inject({ 
      method: 'POST', 
      url: '/roles/editor/permissions/add', 
      payload: { permissionKey: 'example:read', contextType: 'team' },
      headers: { 'x-user-id': 'u1' }
    });
    expect(r2.statusCode).toBe(403);

    // Both permissions work
    app.grantUserPermission('u1', 'roles:team:manage', 'team');
    app.grantUserPermission('u1', 'permissions:example:read:grant:team', 'team');
    const r3 = await f.inject({ 
      method: 'POST', 
      url: '/roles/editor/permissions/add', 
      payload: { permissionKey: 'example:read', contextType: 'team' },
      headers: { 'x-user-id': 'u1' }
    });
    expect(r3.statusCode).toBe(200);
  });

  // Test: Role-permission grant validation - verifies input validation for role-permission grants
  // Edge case: Tests that contextId and contextType cannot be used together
  it('validates role-permission grant inputs', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    registerRoleRoutes(app, defaultRoutePermissionPolicy);
    const f = app.fastify!;

    // Grant global permission for the test
    app.grantUserPermission('u1', 'roles:permissions:grant');

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
    expect(r1.statusCode).toBe(400);
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


