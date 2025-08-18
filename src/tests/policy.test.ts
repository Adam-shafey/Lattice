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
        list: 'roles:list',
        get: 'roles:get',
        delete: 'roles:delete',
        manage: 'roles:manage',
        assign: 'roles:assign',
        remove: 'roles:remove',
        addPerm: {
          roleManage: 'roles:manage',
          permissionGrant: 'permissions:custom:grant:{type}',
        },
        removePerm: {
          roleManage: 'roles:manage',
          permissionRevoke: 'permissions:revoke:{type}',
        },
      },
    } satisfies Partial<RoutePermissionPolicy>;

    const policy = createRoutePermissionPolicy(custom);

    // custom override applied
    expect(policy.roles.create).toBe('custom:create');
    // nested default preserved when not overridden
    expect(policy.roles.addPerm.roleManage).toBe('roles:manage');
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
        create: 'roles:create',
        addPerm: {
          roleManage: 'roles:manage',
          permissionGrant: 'permissions:grant:team',
        },
        removePerm: {
          roleManage: 'roles:manage',
          permissionRevoke: 'permissions:revoke:team',
        },
      },
      users: {
        create: 'users:create',
        list: 'users:read',
        get: 'users:read',
        update: 'users:update',
        delete: 'users:delete',
      },
      permissions: {
        grantUser: 'permissions:grant',
        revokeUser: 'permissions:revoke',
      },
      contexts: {
        create: 'contexts:create',
        get: 'contexts:read',
        update: 'contexts:update',
        delete: 'contexts:delete',
        addUser: 'contexts:add',
        removeUser: 'contexts:remove',
      },
    };

    const errors = validateRoutePermissionPolicy(invalid);

    expect(errors).toEqual([]);
  });

  test('validateRoutePermissionPolicy returns no errors for complete policy', () => {
    const errors = validateRoutePermissionPolicy(defaultRoutePermissionPolicy);
    expect(errors).toEqual([]);
  });
});
