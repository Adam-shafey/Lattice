
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
| **Auth**                     | Password, JWT (access + refresh), placeholders for OAuth2, MFA, social login.                                |
| **Permission Registry**      | In-memory + DB-backed. Wildcard expansion, plugin registration, hot-reloadable.                              |
| **Roles & User Permissions** | RolePermission, UserPermission tables. Scoped per context.                                                   |
| **Role Management**          | Role CRUD, assign/remove roles, grant/revoke role permissions via service + CLI.                             |
| **Context Management**       | Resolve from route/query/header. Supports hierarchies (parent → child contexts).                             |
| **AuthZ Middleware**         | Checks permissions per request, ensures context alignment. Works for both adapters.                          |
| **Plugin System**            | Register plugins with contexts, permissions, and routes.                                                     |
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
  /cache
    redis-client.ts
    permission-cache.ts
  /hooks
    hooks.ts
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
* [ ] Audit logging
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

Hook	Trigger	Purpose / Example Use Cases
onUserCreated(user, context?)	After a new user is added	Assign default permissions, add user to default contexts, send welcome emails, trigger analytics
onUserDeleted(user)	After a user is removed	Clean up related contexts, revoke tokens, remove plugin data, audit logging
onRoleCreated(role)	After a new role is added	Initialize default permissions, sync role to external services
onRoleDeleted(role)	After a role is removed	Remove role associations from users, audit logs
onPermissionAdded(permission, plugin?)	After a permission is registered	Update caches, log changes, notify admin UI
onPermissionRemoved(permission, plugin?)	After a permission is deleted	Revoke related user permissions, invalidate caches
onContextCreated(context)	After a new context is created	Create default roles, assign default users, trigger notifications
onContextDeleted(context)	After a context is deleted	Revoke permissions, clean up associated plugin data
onUserAddedToContext(user, context)	After a user is added to a context	Assign context-specific permissions, trigger onboarding flows
onUserRemovedFromContext(user, context)	After a user is removed from a context	Revoke context-specific permissions, audit logging
onTokenIssued(user, tokenType)	After issuing access or refresh token	Audit login, notify external monitoring services
onTokenRevoked(user, tokenType)	After revoking tokens	Audit security events, clear caches
onPluginRegistered(plugin)	After a plugin is registered	Sync plugin permissions, register plugin-specific hooks, initialize plugin context types
onPluginUnregistered(plugin)	After a plugin is removed	Clean up plugin data, revoke plugin permissions

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

## **9️⃣ Setup & Quickstart (SQLite Dev)**

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

