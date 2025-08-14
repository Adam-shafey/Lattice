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

export const defaultRoutePermissionPolicy = {
  roles: {
    // Context-type scoped operations
    create: 'roles:{type}:create',
    list: 'roles:{type}:list',
    get: 'roles:{type}:read',
    delete: 'roles:{type}:delete',
    manage: 'roles:{type}:manage',
    
    // Assignment operations
    assign: 'roles:assign',
    remove: 'roles:remove',
    
    // Permission operations
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
    addUser: 'contexts:assign',
    removeUser: 'contexts:assign',
  },
} satisfies Required<RoutePermissionPolicy>;


