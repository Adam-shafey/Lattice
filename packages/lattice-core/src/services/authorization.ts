import type { StoragePort, PermissionGrant, RoleAssignment, ContextSelector } from "../ports/storage";

export interface DecisionInput {
  userId: string;
  action: string;
  context?: ContextSelector;
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

export interface AuthorizationService {
  can(input: DecisionInput): Promise<boolean>;
  decide(input: DecisionInput): Promise<Decision>;
}

export interface LatticeConfig {
  storage: StoragePort;
}

export function createAuthorizationService(cfg: LatticeConfig): AuthorizationService {
  const { storage } = cfg;

  async function collectPermissions(userId: string, ctx?: ContextSelector): Promise<Set<string>> {
    const grants: PermissionGrant[] = await storage.getUserPermissionGrants(userId, ctx);
    const roles: RoleAssignment[] = await storage.getUserRoles(userId, ctx);
    for (const r of roles) {
      const perms = await storage.getRolePermissions(r.roleId);
      grants.push(...perms);
    }
    const set = new Set<string>();
    for (const g of grants) {
      set.add(g.permission);
    }
    return set;
  }

  return {
    async can(input: DecisionInput): Promise<boolean> {
      const perms = await collectPermissions(input.userId, input.context);
      return perms.has(input.action);
    },
    async decide(input: DecisionInput): Promise<Decision> {
      const allowed = await this.can(input);
      return { allowed, reason: allowed ? "rbac" : "default-deny" };
    },
  };
}
