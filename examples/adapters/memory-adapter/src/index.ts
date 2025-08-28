import { StoragePort, ContextSelector, PermissionGrant, RoleAssignment } from "../../../packages/lattice-core/src";

export interface Seed {
  userRoles?: Record<string, RoleAssignment[]>;
  rolePermissions?: Record<string, PermissionGrant[]>;
  userGrants?: Record<string, PermissionGrant[]>;
}

export function makeMemoryStorage(seed: Seed): StoragePort {
  return {
    async getUserRoles(userId: string, _ctx?: ContextSelector): Promise<RoleAssignment[]> {
      return seed.userRoles?.[userId] ?? [];
    },
    async getRolePermissions(roleId: string): Promise<PermissionGrant[]> {
      return seed.rolePermissions?.[roleId] ?? [];
    },
    async getUserPermissionGrants(userId: string): Promise<PermissionGrant[]> {
      return seed.userGrants?.[userId] ?? [];
    }
  };
}
