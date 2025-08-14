export interface RoutePermissionPolicy {
  roles?: {
    create: string;
    list: string;
    get: string;
    delete: string;
    assign: string;
    remove: string;
    addPerm: string;
    removePerm: string;
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
    create: 'roles:create',
    list: 'roles:read',
    get: 'roles:read',
    delete: 'roles:delete',
    assign: 'roles:assign',
    remove: 'roles:assign',
    addPerm: 'roles:permissions:grant',
    removePerm: 'roles:permissions:revoke',
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


