/**
 * Route Permission Policy Interface
 *
 * Defines the permission requirements for different API routes.
 * Each route can specify the permission key required and the scope
 * (global, type-wide, or exact context).
 */
export interface RoutePermissionPolicy {
    roles?: {
        create: string;
        list: string;
        get: string;
        delete: string;
        manage: string;
        assign: string;
        remove: string;
        addPerm: {
            roleManage: string;
            permissionGrant: string;
        };
        removePerm: {
            roleManage: string;
            permissionRevoke: string;
        };
    };
    users?: {
        create: string;
        list: string;
        get: string;
        update: string;
        delete: string;
    };
    permissions?: {
        grantUser: string;
        revokeUser: string;
    };
    contexts?: {
        create: string;
        get: string;
        update: string;
        delete: string;
        addUser: string;
        removeUser: string;
    };
}
/**
 * Default Route Permission Policy
 *
 * Provides sensible defaults for route permissions. This policy can be
 * overridden when creating the LatticeCore application to customize
 * permission requirements for different routes.
 *
 * Permission patterns:
 * - Global operations: 'resource:action' (e.g., 'users:create')
 * - Type-scoped operations: 'resource:{type}:action' (e.g., 'roles:team:create')
 * - Context-specific operations: 'resource:action' with exact scope
 */
export declare const defaultRoutePermissionPolicy: {
    roles: {
        create: string;
        list: string;
        get: string;
        delete: string;
        manage: string;
        assign: string;
        remove: string;
        addPerm: {
            roleManage: string;
            permissionGrant: string;
        };
        removePerm: {
            roleManage: string;
            permissionRevoke: string;
        };
    };
    users: {
        create: string;
        list: string;
        get: string;
        update: string;
        delete: string;
    };
    permissions: {
        grantUser: string;
        revokeUser: string;
    };
    contexts: {
        create: string;
        get: string;
        update: string;
        delete: string;
        addUser: string;
        removeUser: string;
    };
};
/**
 * Creates a custom route permission policy by merging with defaults
 *
 * @param customPolicy - Partial policy to merge with defaults
 * @returns Complete policy with custom overrides
 */
export declare function createRoutePermissionPolicy(customPolicy: Partial<RoutePermissionPolicy>): Required<RoutePermissionPolicy>;
/**
 * Validates a route permission policy
 *
 * @param policy - The policy to validate
 * @returns Array of validation errors (empty if valid)
 */
export declare function validateRoutePermissionPolicy(policy: RoutePermissionPolicy): string[];
