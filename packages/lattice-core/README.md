# @lattice/core

Minimal authorization service with pluggable storage. Provides RBAC resolution.

```ts
import { createAuthorizationService } from "@lattice/core";
import { makeMemoryStorage } from "../../examples/adapters/memory-adapter/src";

const storage = makeMemoryStorage({
  userRoles: { u1: [{ roleId: "admin" }] },
  rolePermissions: { admin: [{ permission: "manage" }] }
});

const authz = createAuthorizationService({ storage });
const allowed = await authz.can({ userId: "u1", action: "manage" });
```
