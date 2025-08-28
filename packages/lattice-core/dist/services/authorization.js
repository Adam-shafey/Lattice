export function createAuthorizationService(cfg) {
    const { storage } = cfg;
    async function collectPermissions(userId, ctx) {
        const grants = await storage.getUserPermissionGrants(userId, ctx);
        const roles = await storage.getUserRoles(userId, ctx);
        for (const r of roles) {
            const perms = await storage.getRolePermissions(r.roleId);
            grants.push(...perms);
        }
        const set = new Set();
        for (const g of grants) {
            set.add(g.permission);
        }
        return set;
    }
    return {
        async can(input) {
            const perms = await collectPermissions(input.userId, input.context);
            return perms.has(input.action);
        },
        async decide(input) {
            const allowed = await this.can(input);
            return { allowed, reason: allowed ? "rbac" : "default-deny" };
        },
    };
}
