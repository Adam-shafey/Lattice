/**
 * Route Permission Policy Interface
 * 
 * Defines the permission requirements for different API routes.
 * Each route can specify the permission key required and the scope
 * (global, type-wide, or exact context).
 */
export interface RoutePermissionPolicy {
  roles?: {
    // Context-type scoped operations
    create: string;    // e.g., 'roles:{type}:create'
    list: string;      // e.g., 'roles:{type}:list'
    get: string;       // e.g., 'roles:{type}:read'
    delete: string;    // e.g., 'roles:{type}:delete'
    manage: string;    // e.g., 'roles:{type}:manage'
    
    // Assignment operations (exact context scope)
    assign: string;    // e.g., 'roles:assign'
    remove: string;    // e.g., 'roles:remove'
    
    // Permission operations require both role management and the permission itself
    addPerm: {
      roleManage: string;      // e.g., 'roles:{type}:manage'
      permissionGrant: string; // e.g., 'permissions:{perm}:grant:{type}'
    };
    removePerm: {
      roleManage: string;      // e.g., 'roles:{type}:manage'
      permissionRevoke: string; // e.g., 'permissions:{perm}:revoke:{type}'
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
export const defaultRoutePermissionPolicy = {
  roles: {
    // Context-type scoped operations
    create: 'roles:{type}:create',
    list: 'roles:{type}:list',
    get: 'roles:{type}:read',
    delete: 'roles:{type}:delete',
    manage: 'roles:{type}:manage',
    
    // Assignment operations (type-wide scope - need context type)
    assign: 'roles:assign:{type}',
    remove: 'roles:remove:{type}',
    
    // Permission operations (require both role management and permission grant)
    addPerm: {
      roleManage: 'roles:{type}:manage',
      permissionGrant: 'permissions:{perm}:grant:{type}'
    },
    removePerm: {
      roleManage: 'roles:{type}:manage',
      permissionRevoke: 'permissions:{perm}:revoke:{type}'
    },
  },
  users: {
    // All user operations require global scope
    create: 'users:create',
    list: 'users:read',
    get: 'users:read',
    update: 'users:update',
    delete: 'users:delete',
  },
  permissions: {
    // Permission operations adapt to context
    grantUser: 'permissions:grant',
    revokeUser: 'permissions:revoke',
  },
  contexts: {
    // Context operations mix scopes
    create: 'contexts:create',
    get: 'contexts:read',
    update: 'contexts:update',
    delete: 'contexts:delete',
    addUser: 'contexts:assign',
    removeUser: 'contexts:assign',
  },
} satisfies Required<RoutePermissionPolicy>;

/**
 * Creates a custom route permission policy by merging with defaults
 * 
 * @param customPolicy - Partial policy to merge with defaults
 * @returns Complete policy with custom overrides
 */
export function createRoutePermissionPolicy(
  customPolicy: Partial<RoutePermissionPolicy>
): Required<RoutePermissionPolicy> {
  return {
    ...defaultRoutePermissionPolicy,
    ...customPolicy,
    roles: {
      ...defaultRoutePermissionPolicy.roles,
      ...customPolicy.roles,
      addPerm: {
        ...defaultRoutePermissionPolicy.roles.addPerm,
        ...customPolicy.roles?.addPerm,
      },
      removePerm: {
        ...defaultRoutePermissionPolicy.roles.removePerm,
        ...customPolicy.roles?.removePerm,
      },
    },
  };
}

/**
 * Validates a route permission policy
 * 
 * @param policy - The policy to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateRoutePermissionPolicy(
  policy: RoutePermissionPolicy
): string[] {
  const errors: string[] = [];
  
  // Validate roles policy
  if (policy.roles) {
    const requiredRoleFields = ['create', 'list', 'get', 'delete', 'manage', 'assign', 'remove'];
    for (const field of requiredRoleFields) {
      if (!policy.roles[field as keyof typeof policy.roles]) {
        errors.push(`Missing required roles.${field} permission`);
      }
    }
    
    if (policy.roles.addPerm) {
      if (!policy.roles.addPerm.roleManage) {
        errors.push('Missing roles.addPerm.roleManage permission');
      }
      if (!policy.roles.addPerm.permissionGrant) {
        errors.push('Missing roles.addPerm.permissionGrant permission');
      }
    }
    
    if (policy.roles.removePerm) {
      if (!policy.roles.removePerm.roleManage) {
        errors.push('Missing roles.removePerm.roleManage permission');
      }
      if (!policy.roles.removePerm.permissionRevoke) {
        errors.push('Missing roles.removePerm.permissionRevoke permission');
      }
    }
  }
  
  // Validate users policy
  if (policy.users) {
    const requiredUserFields = ['create', 'list', 'get', 'update', 'delete'];
    for (const field of requiredUserFields) {
      if (!policy.users[field as keyof typeof policy.users]) {
        errors.push(`Missing required users.${field} permission`);
      }
    }
  }
  
  // Validate permissions policy
  if (policy.permissions) {
    const requiredPermissionFields = ['grantUser', 'revokeUser'];
    for (const field of requiredPermissionFields) {
      if (!policy.permissions[field as keyof typeof policy.permissions]) {
        errors.push(`Missing required permissions.${field} permission`);
      }
    }
  }
  
  // Validate contexts policy
  if (policy.contexts) {
    const requiredContextFields = ['create', 'get', 'update', 'delete', 'addUser', 'removeUser'];
    for (const field of requiredContextFields) {
      if (!policy.contexts[field as keyof typeof policy.contexts]) {
        errors.push(`Missing required contexts.${field} permission`);
      }
    }
  }
  
  return errors;
}


