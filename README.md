
---

# **Product Requirements Document — Lattice Core**

## **1️⃣ Purpose / Vision**

Lattice Core is the **foundation of a permission-first SaaS backend**, providing:

* Context-aware access control (multi-tenant, hierarchical)
* Roles and user-level permissions, with wildcard support
* Extensible plugin architecture for routes, contexts, and permissions
* Developer-first experience: CLI, TypeScript types, hot-reloadable permissions
* Minimal core routes: focus on auth and infrastructure, not business logic

**Goal:** Enable developers to spin up secure, modular SaaS apps quickly while leaving domain-specific features to plugins.

---

## **2️⃣ Key Principles**

1. **Permission-first:** All access flows through the core permission registry.
2. **Context-aware:** Every action is scoped to a context (org, team, project, or arbitrary plugin-defined contexts).
3. **Plugin-driven:** Core provides infrastructure; plugins add features and routes.
4. **Open-source & DX-first:** Documentation, CLI tooling, type safety, and hot-reloadable registry.
5. **Adapter-agnostic:** Core works with Fastify or Express via a shared interface.

---

## **3️⃣ Core Features**

| Feature                      | Description                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Auth**                     | Password, JWT (access + refresh), token revocation, password change/reset; placeholders for OAuth2, MFA, social login. |
| **Permission Registry**      | In-memory + DB-backed. Wildcard expansion, plugin registration, hot-reloadable.                              |
| **Roles & User Permissions** | RolePermission, UserPermission tables. Scoped per context.                                                   |
| **Role Management**          | Role CRUD, assign/remove roles, grant/revoke role permissions via service + CLI.                             |
| **Context Management**       | Resolve from route/query/header. Supports hierarchies (parent → child contexts).                             |
| **AuthZ Middleware**         | Checks permissions per request, ensures context alignment. Works for both adapters.                          |
| **Plugin System**            | Register plugins with contexts, permissions, and routes.                                                     |
| **Built-in REST APIs**       | Users CRUD, Contexts CRUD + membership, Roles CRUD + assign/remove + role-perm ops, User permission grant/revoke; all guarded by a modifiable policy. |
| **Audit Logging**            | Records permission checks, context resolutions, token issued/revoked, role and permission grants/revokes.    |
| **Developer Tooling**        | CLI: list-permissions, check-access, roles commands, generate-plugin. TypeScript types for permissions, roles, and contexts. |
| **Caching**                  | Optional Redis-backed cache for effective permissions to optimize performance.                               |

---

## **4️⃣ Core Architecture**

```
/core
  /auth
    jwt.ts
    oauth2.ts
    mfa.ts
    social.ts
  /permissions
    permission-registry.ts
    permission-sync.ts
    wildcard-utils.ts
    user-permission-service.ts
  /context
    context-service.ts
    context-resolver.ts
    hierarchy.ts
  /db
    db-client.ts
  /http
    adapters/
      fastify-adapter.ts
      express-adapter.ts
    middlewares/
      authz-middleware.ts
      audit-logger.ts
    api/
      users.ts
      permissions.ts
      contexts.ts
  /cache
    redis-client.ts
    permission-cache.ts
  /hooks
    hooks.ts
  /policy
    policy.ts
  /cli
    index.ts
    generate-plugin.ts
    list-permissions.ts
    check-access.ts
/prisma
  schema.prisma
/types
  permissions.ts
  roles.ts
  contexts.ts
/tests
  fixtures/
  authz.test.ts
  context.test.ts
  plugin.test.ts
index.ts
package.json
```

---

## **5️⃣ Core DB Schema (Prisma)**

* Tables: `User`, `Role`, `Permission`, `UserPermission`, `RolePermission`, `UserRole`, `Context`, `UserContext`, `AuditLog`.
* Row-level scoping and hierarchical contexts supported.
* Plugin permissions synced at boot via `PermissionRegistry`.
* MVP implemented now: `Permission` (DB-backed) with registry init/sync. Remaining tables are planned.

---

## **6️⃣ Developer Experience Goals**

* **Hot-reloadable permissions** for plugin devs.
* **Type-safe permissions & roles** in TypeScript.
* Minimal friction to add a plugin: `registerPlugin()`.
* **CLI tooling** for inspecting permissions and simulating access.
* Clear logging & audit trail for debugging and security.

---

# **Lattice Core Roadmap Checklist (Prioritized)**

### **Phase 1 — Core MVP**

* [x] Prisma schema + SQLite dev DB setup (Postgres pending)
* [x] User authentication (password + JWT access/refresh)
* [x] Permission registry (in-memory + Prisma-backed with DB sync)
* [x] Role & UserPermission tables + effective permission lookup
* [x] Context service + resolver (route/query/header)
* [x] AuthZ middleware (context + wildcard support)
* [x] Plugin system skeleton (register plugins, register routes). Full plugin packaging/examples pending.
* [x] Fastify + Express adapter skeleton (core features wired; parity features pending)
* [x] CLI: list-permissions, check-access
* [x] Minimal unit tests (auth, permissions, context)

---

### **Phase 1.5 — DX & Scalability**

* [ ] Hierarchical contexts (parent → child)
* [ ] Hot-reloadable plugin permissions at runtime
* [ ] Caching layer for effective permissions (Redis)
* [x] Audit logging
 Implemented full-featured:
Schema: added actorId, targetUserId, requestId, ip, userAgent, resourceType, resourceId, plugin, error, indexes.
Config: audit in CoreSaaS supports enable/disable, sampleRate, redactKeys, sinks (db/stdout).
Service: logs now accept enriched fields and respect config.
Wired existing calls to use actorId vs targetUserId.
Tests: added src/tests/audit.test.ts to verify enabled/disabled behavior.
  - Implemented MVP: permission checks, token issued events, role assign/remove, role perm grant/revoke, user perm grant/revoke logged to `AuditLog`.
* [ ] CLI: generate-plugin scaffolding
* [ ] TypeScript types for permissions, roles, contexts
* [ ] Testing utilities / fixtures for devs
* [ ] Adapter parity improvements (Express vs Fastify features)
* [ ] Lifecycle hooks framework (`core.hooks`) with typed registration and execution
* [ ] Emit hooks for: onUserCreated/onUserDeleted, onRoleCreated/onRoleDeleted, onPermissionAdded/onPermissionRemoved, onContextCreated/onContextDeleted, onUserAddedToContext/onUserRemovedFromContext, onTokenIssued/onTokenRevoked, onPluginRegistered/onPluginUnregistered. Don't forget also hooks for role assignment, role removal, etc
* [ ] Hook execution policy (sequential vs parallel where safe) and cancelation support
* [ ] Hook tests and docs

---

### **Phase 2 — Full End-State Core**

* [ ] Versioned permissions (track plugin changes, deprecation)
* [ ] Advanced auth integration (MFA, OTP, social login)
* [ ] Multi-context requests (resolve conflicts hierarchically)
* [ ] Metrics & observability for permission checks
* [ ] Starter guide & visual request flow for devs
* [ ] Optional hooks for admin/dashboard UI integration
* [ ] Plugin ecosystem examples (Teams, Billing, Uploads, Metrics)

---


## **7️⃣ Lifecycle Hooks**

| **Hook**                                     | **Trigger**                             | **Purpose / Example Use Cases**                                           |
| -------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| **onUserUpdated(user, changes)**             | When a user's profile changes           | Sync profile data to external CRMs, refresh caches, update search indexes |
| **onRoleUpdated(role, changes)**             | When a role's metadata changes          | Update caches, re-sync permissions, notify admins                         |
| **onPermissionUpdated(permission, changes)** | When a permission's metadata changes    | Update caches, re-sync with plugins, notify admins                        |
| **onContextUpdated(context, changes)**       | When a context changes name or settings | Recalculate derived data, update UI, notify affected users                |
| **onSessionCreated(user, session)**          | When a new login session starts         | Real-time monitoring, analytics, anomaly detection                        |
| **onSessionTerminated(user, session)**       | When a session ends (logout, timeout)   | Audit logging, trigger cleanup jobs                                       |
| **onAuthFailed(userIdentifier, reason)**     | When an authentication attempt fails    | Track brute-force attempts, send security alerts                          |
| **onRateLimitExceeded(user, endpoint)**      | When a user hits an API rate limit      | Alert admins, log abuse, temporarily throttle                             |
| **onPluginUpdated(plugin, changes)**         | When plugin metadata changes            | Update plugin registry, re-register permissions                           |
| **onSystemStartup()**                        | When Lattice Core boots                 | Warm caches, register all permissions, run health checks                  |
| **onSystemShutdown()**                       | When Lattice Core shuts down            | Flush logs, cleanup temporary data, notify monitoring tools               |




Implementation Notes

- Hook registration is centralized in `core.hooks`:

```ts
core.hooks.onUserCreated = async (user, context) => { /* ... */ }
```

- Multiple hooks per event:

```ts
core.hooks.register('onUserCreated', async (user) => { /* ... */ })
core.hooks.register('onUserCreated', async (user) => { /* ... */ })
```

- Core runs all registered functions in sequence (or parallel if safe).
- Cancelable hooks: a hook can throw or return false to halt an operation if needed.
- Plugin safety: hooks never modify core state directly outside service APIs.
- All hooks are type-checked for DX.

Example: Combining Hooks for a New User

```ts
core.hooks.register('onUserCreated', async (user) => {
  await core.PermissionRegistry.assignPermissions(user.id, ['default:read'])
})

core.hooks.register('onUserCreated', async (user, context) => {
  if (context) {
    await core.contextService.addUserToContext(user.id, context.id)
  }
})
```

Both hooks execute automatically when `createUser()` is called. Devs can mix permission assignments, context setup, analytics, notifications, etc., without touching core.

💡 Takeaway: This hook system makes Lattice Core extensible and future-proof. Any lifecycle event is a plugin extension point.

---

## **8️⃣ Roles Quickstart**

CLI examples:

```bash
# create/list
lattice roles:create --name admin
lattice roles:list

# assign/remove role to a user
lattice roles:assign --role admin --userId user_123
lattice roles:remove --role admin --userId user_123

# add/remove a permission to role
lattice roles:add-perm --role admin --permission example:read
lattice roles:remove-perm --role admin --permission example:read

# list user roles
lattice roles:user-roles --userId user_123
```

Programmatic:

```ts
import { RoleService } from './core/roles/role-service'
const roles = new RoleService()
await roles.createRole('admin')
await roles.assignRoleToUser({ roleName: 'admin', userId: 'user_123' })
await roles.addPermissionToRole({ roleName: 'admin', permissionKey: 'example:read' })
```

---

## **9️⃣ Audit Logging (Full)**

Capabilities:
- Events: permission.check (success/failure), context.resolve, token.issued/token.revoked, role.created/role.deleted, role.assigned/role.removed, permission.user.granted/permission.user.revoked, permission.role.granted/permission.role.revoked.
- Schema enrichment: actorId vs targetUserId, requestId, ip, userAgent, resourceType/resourceId, plugin, error, metadata; indexed for querying.
- Configurable: enable/disable, sampleRate, redactKeys, sinks (db/stdout).
- Toggle via `audit` in `CoreSaaS` config.

Example:
```ts
const app = CoreSaaS({
  db: { provider: 'sqlite' },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d', secret: '...' },
  audit: { enabled: true, sampleRate: 1.0, redactKeys: ['password'], sinks: ['db', 'stdout'] },
})
```

---

## **10️⃣ Setup & Quickstart (SQLite Dev)**

### Route-level Permissions

Core exposes a modifiable route permission policy used by built-in routes. You can override defaults via `policy` in `CoreSaaS` config.

Defaults:

```ts
policy: {
  users: {
    create: 'users:create', list: 'users:read', get: 'users:read', update: 'users:update', delete: 'users:delete'
  },
  permissions: {
    grantUser: 'permissions:grant', revokeUser: 'permissions:revoke'
  },
  contexts: {
    create: 'contexts:create', get: 'contexts:read', update: 'contexts:update', delete: 'contexts:delete', addUser: 'contexts:assign', removeUser: 'contexts:assign'
  }
}
```

Override example:

```ts
const app = CoreSaaS({
  ...,
  policy: {
    users: { create: 'admin:users:create' },
    permissions: { grantUser: 'security:grant' },
  }
})
```

1. Environment
   - Node.js 18+
   - Set `DATABASE_URL` to `file:./dev.db`
     - PowerShell: `$env:DATABASE_URL = 'file:./dev.db'`
     - Bash: `export DATABASE_URL="file:./dev.db"`

2. Install & initialize DB
   - `npm install`
   - `npx prisma generate`
   - `npx prisma db push`

3. Run dev server
   - `npm run dev`
   - Test: `GET http://localhost:3000/ping` → `{ pong: true }`
   - Protected example: `GET http://localhost:3000/secure/ctx_1/info` with header `x-user-id: user_123`

4. CLI
   - `npm run build`
   - `node dist/core/cli/index.js list-permissions`
   - `node dist/core/cli/index.js check-access --userId user_123 --contextId ctx_1 --permission example:read`

Notes
- Permission Registry initializes from DB and syncs on `app.listen()`.
- Plugin system currently registers permissions and routes; generator/discovery arrive in Phase 1.5.
- Adapter parity features (error normalization, streaming, uploads) are post-MVP.

### Production Readiness Checklist (What we did vs next)

Done now:
- Built-in REST APIs guarded by policy (Users, Contexts, Roles, User-Permissions)
- E2E tests for auth/login/refresh, protected routes, role/permission flows, context membership
- Full audit logging with config and request metadata
- Policy overrides for route permissions

Next to consider:
- Validation on all endpoints (add zod) and better error normalization
- Hierarchical contexts with inheritance
- Prisma migrations for all environments, plus indexes for hot queries
- Rate limiting, password policy, secure reset delivery
- Caching (Redis) for effective permissions and ancestor chains
- CLI additions (generate-plugin, audit queries) and docs for Roles API and route-permission matrix

