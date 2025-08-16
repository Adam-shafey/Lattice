import { describe, expect, test } from 'vitest';
import {
  createRoutePermissionPolicy,
  defaultRoutePermissionPolicy,
  validateRoutePermissionPolicy,
  type RoutePermissionPolicy,
} from '../core/policy/policy';

describe('Route permission policy utilities', () => {
  test('createRoutePermissionPolicy merges defaults with custom overrides', () => {
    const custom = {
      roles: {
        create: 'custom:create',
        addPerm: {
          permissionGrant: 'permissions:custom:grant:{type}',
        },
      },
    } satisfies Partial<RoutePermissionPolicy>;

    const policy = createRoutePermissionPolicy(custom);

    // custom override applied
    expect(policy.roles.create).toBe('custom:create');
    // nested default preserved when not overridden
    expect(policy.roles.addPerm.roleManage).toBe(defaultRoutePermissionPolicy.roles.addPerm.roleManage);
    // nested override applied
    expect(policy.roles.addPerm.permissionGrant).toBe('permissions:custom:grant:{type}');
    // untouched sections fall back to defaults
    expect(policy.users).toEqual(defaultRoutePermissionPolicy.users);
  });

  test('validateRoutePermissionPolicy reports missing permissions', () => {
    const invalid: RoutePermissionPolicy = {
      roles: {
        list: 'roles:list',
        get: 'roles:get',
        delete: 'roles:delete',
        manage: 'roles:manage',
        assign: 'roles:assign',
        remove: 'roles:remove',
        addPerm: {
          permissionGrant: 'permissions:grant:team',
        },
        removePerm: {
          roleManage: 'roles:manage',
        },
      },
      users: {
        list: 'users:read',
        get: 'users:read',
        update: 'users:update',
        delete: 'users:delete',
      },
      permissions: {
        revokeUser: 'permissions:revoke',
      },
      contexts: {
        create: 'contexts:create',
        get: 'contexts:read',
        update: 'contexts:update',
        delete: 'contexts:delete',
        addUser: 'contexts:add',
      },
    };

    const errors = validateRoutePermissionPolicy(invalid);

    expect(errors).toEqual([
      'Missing required roles.create permission',
      'Missing roles.addPerm.roleManage permission',
      'Missing roles.removePerm.permissionRevoke permission',
      'Missing required users.create permission',
      'Missing required permissions.grantUser permission',
      'Missing required contexts.removeUser permission',
    ]);
  });

  test('validateRoutePermissionPolicy returns no errors for complete policy', () => {
    const errors = validateRoutePermissionPolicy(defaultRoutePermissionPolicy);
    expect(errors).toEqual([]);
  });
});
