# Memory Adapter

Simple in-memory storage adapter for `@lattice/core` used for demos and tests.

```ts
import { makeMemoryStorage } from "./src";
import { createAuthorizationService } from "@lattice/core";

const storage = makeMemoryStorage({
  userRoles: { u1: [{ roleId: "admin" }] },
  rolePermissions: { admin: [{ permission: "manage" }] },
});

const authz = createAuthorizationService({ storage });
```
