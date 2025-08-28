import { describe, it, expect } from "vitest";
import { createAuthorizationService, StoragePort, PermissionGrant, RoleAssignment } from "../src";

const storage: StoragePort = {
  async getUserRoles(userId: string): Promise<RoleAssignment[]> {
    if (userId === "u1") {
      return [{ roleId: "admin" }];
    }
    return [];
  },
  async getRolePermissions(roleId: string): Promise<PermissionGrant[]> {
    if (roleId === "admin") {
      return [{ permission: "manage" }];
    }
    return [];
  },
  async getUserPermissionGrants(userId: string): Promise<PermissionGrant[]> {
    if (userId === "u2") {
      return [{ permission: "read" }];
    }
    return [];
  }
};

describe("rbac", () => {
  const authz = createAuthorizationService({ storage });
  it("allows via role", async () => {
    const allowed = await authz.can({ userId: "u1", action: "manage" });
    expect(allowed).toBe(true);
  });
  it("allows via direct grant", async () => {
    const allowed = await authz.can({ userId: "u2", action: "read" });
    expect(allowed).toBe(true);
  });
  it("denies when missing", async () => {
    const allowed = await authz.can({ userId: "u3", action: "read" });
    expect(allowed).toBe(false);
  });
});
