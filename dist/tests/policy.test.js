"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const policy_1 = require("../core/policy/policy");
(0, vitest_1.describe)('Route permission policy utilities', () => {
    (0, vitest_1.test)('createRoutePermissionPolicy merges defaults with custom overrides', () => {
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
        };
        const policy = (0, policy_1.createRoutePermissionPolicy)(custom);
        // custom override applied
        (0, vitest_1.expect)(policy.roles.create).toBe('custom:create');
        // nested default preserved when not overridden
        (0, vitest_1.expect)(policy.roles.addPerm.roleManage).toBe('roles:manage');
        // nested override applied
        (0, vitest_1.expect)(policy.roles.addPerm.permissionGrant).toBe('permissions:custom:grant:{type}');
        // untouched sections fall back to defaults
        (0, vitest_1.expect)(policy.users).toEqual(policy_1.defaultRoutePermissionPolicy.users);
    });
    (0, vitest_1.test)('validateRoutePermissionPolicy reports missing permissions', () => {
        const invalid = {
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
        const errors = (0, policy_1.validateRoutePermissionPolicy)(invalid);
        (0, vitest_1.expect)(errors).toEqual([]);
    });
    (0, vitest_1.test)('validateRoutePermissionPolicy returns no errors for complete policy', () => {
        const errors = (0, policy_1.validateRoutePermissionPolicy)(policy_1.defaultRoutePermissionPolicy);
        (0, vitest_1.expect)(errors).toEqual([]);
    });
});
