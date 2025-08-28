export interface ContextSelector {
  id?: string;
  type?: string;
  path?: string[];
}

export interface PermissionGrant {
  permission: string;
  context?: ContextSelector | "*" | null;
}

export interface RoleAssignment {
  roleId: string;
  context?: ContextSelector | "*" | null;
}

export interface StoragePort {
  getUserRoles(userId: string, ctx?: ContextSelector): Promise<RoleAssignment[]>;
  getRolePermissions(roleId: string): Promise<PermissionGrant[]>;
  getUserPermissionGrants(userId: string, ctx?: ContextSelector): Promise<PermissionGrant[]>;
}
