
---

# Lattice Core

## Vision

Lattice Core is the foundation of a permission-first SaaS backend, providing:

- Context-aware access control (multi-tenant, hierarchical)
- Roles and user-level permissions, with wildcard support
- Extensible plugin architecture for routes, contexts, and permissions
- Developer-first experience: CLI, TypeScript types, hot-reloadable permissions
- Minimal core routes: focus on auth and infrastructure, not business logic
- **Production-ready service layer** with standardized patterns and error handling

**Goal:** Enable developers to spin up secure, modular SaaS apps quickly while leaving domain-specific features to plugins.

---

## Key Principles

1. **Permission-first:** All access flows through the core permission registry.
2. **Context-aware:** Every action is scoped to a context (org, team, project, or arbitrary plugin-defined contexts).
3. **Plugin-driven:** Core provides infrastructure; plugins add features and routes.
4. **Open-source & DX-first:** Documentation, CLI tooling, type safety, and hot-reloadable registry.
5. **Adapter-agnostic:** Core works with Fastify or Express via a shared interface.
6. **Service-oriented:** Production-ready services with consistent patterns and error handling.

---

## Core Features

| Feature                      | Description                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Auth**                     | Password, JWT (access + refresh), token revocation, password change/reset with bcrypt hashing. WIP OAuth2, MFA, social login. |
| **Permission Registry**      | In-memory + DB-backed. Wildcard expansion, WIP: plugin registration, WIP: hot-reloadable.                              |
| **Roles & User Permissions** | RolePermission, UserPermission tables. Scoped per context.                                                   |
| **Role Management**          | Role CRUD, assign/remove roles, grant/revoke role permissions via service + CLI.                             |
| **Context Management**       | Resolve from route/query/header. Supports hierarchies (parent → child contexts).                             |
| **AuthZ Middleware**         | Checks permissions per request, ensures context alignment. Works for both adapters.                          |
| **Plugin System**            | Register plugins with contexts, roles, permissions, and routes.                                                     |
| **Built-in REST APIs**       | Users CRUD, Contexts CRUD + membership, Roles CRUD + assign/remove + role-perm ops, User permission grant/revoke; all guarded by a modifiable policy. |
| **API Documentation**        | Comprehensive OpenAPI 3.0 specification with Swagger UI integration. Auto-generated documentation with detailed schemas, request/response examples, and authentication requirements. |
| **Developer Tooling**        | CLI: list-permissions, check-access, roles commands, user management, permission management, context management. TypeScript types for permissions, roles, and contexts. |
| **Caching**                  | WIP: Optional Redis-backed cache for effective permissions to optimize performance.                               |
| **Service Layer**            | Production-ready services with standardized error handling, input validation, and transaction management. |

---

## Core Architecture

```
/core
  /auth
    jwt.ts - Handles JSON Web Token (JWT) operations for authentication.
    oauth2.ts - WIP: Will handle OAuth2 authentication flows.
    mfa.ts - WIP: Will implement multi-factor authentication.
    social.ts - WIP: Will manage social login integrations.
  /cli
    index.ts - Entry point for command-line interface (CLI) operations.
  /db
    db-client.ts - Provides database client setup and connections.
  /http
    /adapters
      express-adapter.ts - Adapter for integrating with Express.js.
      fastify-adapter.ts - Adapter for integrating with Fastify.
    /api
      auth.ts - Manages authentication-related API routes.
      contexts.ts - Handles context-related API routes.
      permissions.ts - Manages permission-related API routes.
      roles.ts - Handles role-related API routes.
      users.ts - Manages user-related API routes.
    authorize.ts - Middleware for handling authorization logic.
  /permissions
    effective-permissions.ts - Calculates effective permissions for users.
    permission-registry.ts - Manages the registration and lookup of permissions.
    wildcard-utils.ts - Provides utilities for handling wildcard permissions.
  /policy
    policy.ts - Defines policies for route permissions and access control.
  /services
    base-service.ts - Abstract base class providing common service functionality.
    interfaces.ts - TypeScript interfaces for all core services.
    service-factory.ts - Centralized service management and instantiation.
    context-service.ts - Manages context operations and resolutions.
    role-service.ts - Handles role management and operations.
    user-service.ts - Manages user accounts, authentication, and profile operations.
    user-permission-service.ts - Manages user permissions and operations.
    index.ts - Comprehensive barrel file exporting all service components.
  /tests
    auth.test.ts - Tests for authentication functionality.
    authz.test.ts - Tests for authorization middleware.
    context.test.ts - Tests for context management.
    e2e.access-flows.test.ts - End-to-end tests for access flows.
    e2e.auth.test.ts - End-to-end tests for authentication.
    e2e.roles.test.ts - End-to-end tests for role management.
    e2e.routes.test.ts - End-to-end tests for route handling.
    permissions.test.ts - Tests for permission management.
/dev.ts - Development script for bootstrapping the application.
/index.ts - Main entry point for the application.
/prisma
  schema.prisma - Defines the database schema using Prisma.
index.ts - Main entry point for the application.
package.json - Contains project metadata and dependencies.
```

---

## Service Architecture

Lattice Core provides a production-ready service layer with consistent patterns:

### Service Hierarchy

```
BaseService (abstract)
├── ContextService - Context management with full CRUD operations
├── RoleService - Role management with context-aware assignments
├── UserService - User management with authentication and profile operations
└── UserPermissionService - Permission management with effective permission calculation

ServiceFactory - Centralized service management with dependency injection
```

### Key Service Features

- **Standardized Error Handling**: All services use `ServiceError` with predefined error types
- **Input Validation**: Comprehensive validation with descriptive error messages
- **Transaction Support**: Proper transaction handling for multi-step operations
- **Interface Contracts**: All services implement TypeScript interfaces for better testing
- **Dependency Injection**: Services receive dependencies through constructor injection
- **Type Safety**: Full TypeScript support with proper type definitions

### Service Factory

The `ServiceFactory` manages all service instances and provides centralized access:

```typescript
// Initialize service factory
  const factory = new ServiceFactory({
    db: prismaClient,
  });

// Access services
const userService = factory.getUserService();
const roleService = factory.getRoleService();
const contextService = factory.getContextService();
  const permissionService = factory.getPermissionService();
```

### Application Integration

The main application provides convenient access to all services:

```typescript
const app = CoreSaaS({
  db: { provider: 'postgres' },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d' }
});

// Access services through the application
const userService = app.userService;
const roleService = app.roleService;
const contextService = app.contextService;
const permissionService = app.permissionService;

// Or access the service factory directly
const services = app.services;
```

---

## Core DB Schema (Prisma)

- Tables: `User`, `Role`, `Permission`, `UserPermission`, `RolePermission`, `UserRole`, `Context`, `UserContext`, `RevokedToken`, `PasswordResetToken`.
- Row-level scoping and V2: hierarchical contexts supported.
- Plugin permissions synced at boot via `PermissionRegistry`.
- All tables implemented and functional.

---

## Developer Experience Goals

- WIP: **Hot-reloadable permissions** for plugin devs.
- **Type-safe permissions & roles** in TypeScript.
- WIP: Minimal friction to add a plugin: `registerPlugin()`.
- **CLI tooling** for inspecting permissions and simulating access.
- Clear logging for debugging and security.
- **Production-ready services** with consistent patterns and error handling.

---

# Lattice Core Roadmap Checklist (Prioritized)

### Phase 1 — Core MVP

- [x] Prisma schema + SQLite dev DB setup (Postgres pending)
- [x] User authentication (password + JWT access/refresh)
- [x] Permission registry (in-memory + Prisma-backed with DB sync)
- [x] Role & UserPermission tables + effective permission lookup
- [x] Context service + resolver (route/query/header)
- [x] AuthZ middleware (context + wildcard support)
- [x] Plugin system skeleton (register plugins, register routes). Full plugin packaging/examples pending.
- [x] Fastify + Express adapter skeleton (core features wired; parity features pending)
- [x] CLI: list-permissions, check-access
- [x] Minimal unit tests (auth, permissions, context)
- [x] Input validation (Zod) on built-in REST APIs
- [x] **Service layer refactoring** - Production-ready services with standardized patterns

---

### Phase 1.5 — DX & Scalability

- [ ] Hierarchical contexts (parent → child)
- [ ] Hot-reloadable plugin permissions at runtime
- [ ] Caching layer for effective permissions (Redis)
- [x] **Service factory and dependency injection** - Centralized service management
- [x] **User service implementation** - Complete user management with authentication
- [x] **Enhanced CLI** - User management, permission management, context management commands
- [x] **Application integration** - Main app and CLI refactored to use new service patterns
- [ ] CLI: generate-plugin scaffolding
- [ ] TypeScript types for permissions, roles, contexts
- [ ] Testing utilities / fixtures for devs
- [ ] Adapter parity improvements (Express vs Fastify features)
- [ ] Lifecycle hooks framework (`core.hooks`) with typed registration and execution
- [ ] Emit hooks for: onUserCreated/onUserDeleted, onRoleCreated/onRoleDeleted, onPermissionAdded/onPermissionRemoved, onContextCreated/onContextDeleted, onUserAddedToContext/onUserRemovedFromContext, onTokenIssued/onTokenRevoked, onPluginRegistered/onPluginUnregistered. Don't forget also hooks for role assignment, role removal, etc
- [ ] Hook execution policy (sequential vs parallel where safe) and cancellation support
- [ ] Hook tests and docs

---

### Phase 2 — Full End-State Core

- [ ] Versioned permissions (track plugin changes, deprecation)
- [ ] Advanced auth integration (MFA, OTP, social login)
- [ ] Multi-context requests (resolve conflicts hierarchically)
- [ ] Metrics & observability for permission checks
- [ ] Starter guide & visual request flow for devs
- [ ] Optional hooks for admin/dashboard UI integration
- [ ] Plugin ecosystem examples (Teams, Billing, Uploads, Metrics)

---

## Lifecycle Hooks (WIP)

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

---

## Implementation Notes

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

## Context-type Aware Permissions (Implemented)

- Updated `checkAccess` to accept `{ type, id }` for context scoping
- Extended schema with `contextType` on `UserPermission`, `RolePermission`, and `UserRole`
- Matching order: exact (type+id) → type-wide (type+null) → global (null+null)
- Wildcards preserved in permission keys (e.g., `example:*`)
- REST endpoints accept `{ contextType, contextId }` (backfills type from `Context` when only id is given)
- E2E tests cover exact/type-wide/global flows
- Role assignments are context-type aware (validates type matches context)
- Type-wide operations (e.g., role-permission grants) require global scope
- Scope enforcement in authorize middleware:
  - `exact`: Requires permission in exact context (or global)
  - `global`: Requires global permission (null context)
  - `type-wide`: Requires permission for context type

### Role Management & Permissions (Implemented)

Core implements a context-type aware role management system with strict permission requirements:

1. **Role Operations**:
   - Creating/managing roles requires type-specific permission (e.g., `roles:team:create` for team roles)
   - Role operations are scoped to their context type (team roles can only be used in team contexts)
   - Global operations (like listing all roles) require type-wide permission

2. **Role-Permission Grants**:
   To grant a permission to a role, you need BOTH:
   - Permission to manage roles of that type (`roles:team:manage`)
   - Permission to grant the specific permission in that context type (`permissions:read:grant:team`)
   
3. **Role Assignments**:
   - Assigning roles requires exact context permission
   - Context type is validated (can't assign team role in org context)
   - Role assignments are always context-specific

Example policy configuration:

```ts
policy: {
  roles: {
    // Role management (type-scoped)
    create: 'roles:{type}:create',     // Can create roles of type {type}
    get: 'roles:{type}:read',         // Can read roles of type {type}
    list: 'roles:{type}:list',        // Can list roles of type {type}
    delete: 'roles:{type}:delete',    // Can delete roles of type {type}
    manage: 'roles:{type}:manage',    // Can manage roles of type {type}
    
    // Role assignments (context-scoped)
    assign: 'roles:assign',          // Can assign roles in specific contexts
    remove: 'roles:remove',          // Can remove roles in specific contexts
    
    // Permission operations (requires both role management and permission grant)
    addPerm: {
      roleManage: 'roles:{type}:manage',                  // Must have role management
      permissionGrant: 'permissions:{perm}:grant:{type}'  // Must have grant permission
    },
    removePerm: {
      roleManage: 'roles:{type}:manage',                  // Must have role management
      permissionRevoke: 'permissions:{perm}:revoke:{type}'// Must have revoke permission
    }
  }
}
```

## Service Usage Examples

### User Management

```typescript
// Create a new user
const user = await app.userService.createUser({
  email: 'user@example.com',
  password: 'securepassword123',
  context: { actorId: 'system' }
});

// Get user by email
const user = await app.userService.getUserByEmail('user@example.com');

// Update user profile
await app.userService.updateUser('user_123', {
  email: 'newemail@example.com'
}, { actorId: 'admin_456' });

// Change password
await app.userService.changePassword('user_123', 'oldpass', 'newpass123', {
  actorId: 'user_123'
});
```

### Role Management

```typescript
// Create a role
const role = await app.roleService.createRole({
  name: 'admin',
  contextType: 'organization',
  context: { actorId: 'system' }
});

// Assign role to user
await app.roleService.assignRoleToUser({
  roleName: 'admin',
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Add permission to role
await app.roleService.addPermissionToRole({
  roleName: 'admin',
  permissionKey: 'users:delete',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

### Permission Management

```typescript
// Grant permission to user
await app.permissionService.grantToUser({
  userId: 'user_123',
  permissionKey: 'users:read',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Check user permission
const hasPermission = await app.permissionService.checkUserPermission({
  userId: 'user_123',
  permissionKey: 'users:read',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Get effective permissions
const permissions = await app.permissionService.getUserEffectivePermissions({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

### Context Management

```typescript
// Create a context
const context = await app.contextService.createContext({
  id: 'org_123',
  type: 'organization',
  name: 'Acme Corp',
  context: { actorId: 'system' }
});

// Resolve context from request
const resolved = app.contextService.resolveContext({
  routeParam: 'org_123',
  header: 'x-context-id',
  query: 'context'
});

// Add user to context
await app.contextService.addUserToContext({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

## Roles Quickstart

CLI examples:

```bash
# User Management
lattice users:create --email user@example.com --password secret123
lattice users:list --limit 20 --offset 0
lattice users:get --email user@example.com
lattice users:delete --email user@example.com

# Role Management
lattice roles:create --name admin --contextType organization
lattice roles:list --contextType organization
lattice roles:assign --role admin --email user@example.com --contextId org_123
lattice roles:remove --role admin --email user@example.com --contextId org_123
lattice roles:add-perm --role admin --permission users:read --contextId org_123
lattice roles:remove-perm --role admin --permission users:read --contextId org_123
lattice roles:user-roles --email user@example.com --contextId org_123

# Permission Management
lattice permissions:grant --permission users:read --email user@example.com --contextId org_123
lattice permissions:revoke --permission users:read --email user@example.com --contextId org_123
lattice permissions:user --email user@example.com --contextId org_123
lattice permissions:effective --email user@example.com --contextId org_123

# Context Management
lattice contexts:create --id org_123 --type organization --name "Acme Corp"
lattice contexts:list --type organization --limit 10

# System Commands
lattice list-permissions
lattice check-access --userId user_123 --contextId org_123 --permission users:read
```

Programmatic:

```ts
import { CoreSaaS } from './src/index'

const app = CoreSaaS({
  db: { provider: 'postgres' },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d' },
})

// Use services
await app.userService.createUser({ email: 'user@example.com', password: 'secret123' })
await app.roleService.createRole({ name: 'admin', contextType: 'organization' })
await app.roleService.assignRoleToUser({ roleName: 'admin', userId: 'user_123', contextId: 'org_456' })
await app.roleService.addPermissionToRole({ roleName: 'admin', permissionKey: 'example:read' })
```

---

---

## Setup & Quickstart (SQLite Dev)

### Route-level Permissions & Scoping

Core exposes a modifiable route permission policy used by built-in routes. You can override defaults via `policy` in `CoreSaaS` config.

Each route is configured with both a permission key and a scope requirement:
- `exact`: Requires permission in the exact context (e.g., role assignments)
- `global`: Requires global permission (e.g., user management, type-wide operations)
- `type-wide`: Requires permission for the context type

Defaults:

```ts
policy: {
  roles: {
    // Global operations
    create: 'roles:create',           // scope: global
    get: 'roles:read',               // scope: global
    list: 'roles:read',              // scope: global
    delete: 'roles:delete',          // scope: global
    addPerm: 'roles:permissions:grant',    // scope: global (for type-wide grants)
    removePerm: 'roles:permissions:revoke', // scope: global (for type-wide revokes)
    
    // Context-specific operations
    assign: 'roles:assign',          // scope: exact (requires contextId)
    remove: 'roles:assign'           // scope: exact (requires contextId)
  },
  users: {
    // All user operations require global scope
    create: 'users:create',
    list: 'users:read',
    get: 'users:read',
    update: 'users:update',
    delete: 'users:delete'
  },
  permissions: {
    // Permission operations adapt to context
    grantUser: 'permissions:grant',   // scope: global for type-wide, exact for contextId
    revokeUser: 'permissions:revoke'  // scope: global for type-wide, exact for contextId
  },
  contexts: {
    // Context operations mix scopes
    create: 'contexts:create',        // scope: global for new types, exact for instances
    get: 'contexts:read',            // scope: exact
    update: 'contexts:update',       // scope: exact
    delete: 'contexts:delete',       // scope: exact
    addUser: 'contexts:assign',      // scope: exact
    removeUser: 'contexts:assign'    // scope: exact
  }
}
```

Override example:

```ts
const app = CoreSaaS({
  // ...
  policy: {
    users: { create: 'admin:users:create' },
    permissions: { grantUser: 'security:grant' },
  }
})
```

### Route–Permission Matrix

| Route | Method | Permission Key | Scope | Notes |
| ----- | ------ | -------------- | ----- | ----- |
| `/users` | POST | `users:create` | global | System-wide operation |
| `/users` | GET | `users:read` | global | System-wide operation |
| `/users/:id` | GET | `users:read` | global | System-wide operation |
| `/users/:id` | PUT | `users:update` | global | System-wide operation |
| `/users/:id` | DELETE | `users:delete` | global | System-wide operation |
| `/permissions/user/grant` | POST | `permissions:grant` | dynamic | global for type-wide, exact for contextId |
| `/permissions/user/revoke` | POST | `permissions:revoke` | dynamic | global for type-wide, exact for contextId |
| `/contexts` | POST | `contexts:create` | dynamic | global for new types, exact for instances |
| `/contexts/:id` | GET | `contexts:read` | exact | Context-specific |
| `/contexts/:id` | PUT | `contexts:update` | exact | Context-specific |
| `/contexts/:id` | DELETE | `contexts:delete` | exact | Context-specific |
| `/contexts/:id/users/add` | POST | `contexts:assign` | exact | Context-specific |
| `/contexts/:id/users/remove` | POST | `contexts:assign` | exact | Context-specific |
| `/roles` | POST | `roles:create` | global | System-wide operation |
| `/roles` | GET | `roles:read` | global | System-wide operation |
| `/roles/:name` | GET | `roles:read` | global | System-wide operation |
| `/roles/:name` | DELETE | `roles:delete` | global | System-wide operation |
| `/roles/assign` | POST | `roles:assign` | exact | Requires contextId + type |
| `/roles/remove` | POST | `roles:assign` | exact | Requires contextId + type |
| `/roles/:name/permissions/add` | POST | `roles:permissions:grant` | global | For type-wide grants |
| `/roles/:name/permissions/remove` | POST | `roles:permissions:revoke` | global | For type-wide revokes |

All keys are developer-overridable via the `policy` option.

### Input Validation (Zod)

All REST inputs are validated with Zod. Invalid payloads return a consistent error shape:

```json
{
  "error": "Invalid input",
  "issues": [
    {
      "code": "invalid_string",
      "path": ["email"],
      "message": "Invalid email"
    }
  ]
}
```

### Roles API

Endpoints (all guarded by policy):
- POST `/roles` { name }
  - Scope: global
  - Creates a new role with unique key
- GET `/roles`
  - Scope: global
  - Lists all roles
- GET `/roles/:name`
  - Scope: global
  - Gets role by name
- DELETE `/roles/:name`
  - Scope: global
  - Deletes role and all assignments
- POST `/roles/assign` { roleName, userId, contextId, contextType }
  - Scope: exact
  - Assigns role to user in specific context
  - Validates context type matches
- POST `/roles/remove` { roleName, userId, contextId, contextType }
  - Scope: exact
  - Removes role from user in specific context
  - Validates context type matches
- POST `/roles/:name/permissions/add` { permissionKey, contextId?, contextType? }
  - Scope: global
  - Grants permission to role
  - Type-wide if contextType provided
  - Context-specific if contextId provided
- POST `/roles/:name/permissions/remove` { permissionKey, contextId?, contextType? }
  - Scope: global
  - Revokes permission from role
  - Type-wide if contextType provided
  - Context-specific if contextId provided

Policy keys used:
- `roles.create`, `roles.list`, `roles.get`, `roles.delete` (all global scope)
- `roles.assign`, `roles.remove` (exact scope, requires context)
- `roles.addPerm`, `roles.removePerm` (global scope for type-wide operations)

All input is validated with Zod. Context type is validated against context records.

## API Documentation

Lattice Core provides comprehensive API documentation through OpenAPI 3.0 specification and Swagger UI integration.

### Accessing Documentation

- **Swagger UI**: `http://localhost:3000/docs` (when running `npm run dev`)
- **OpenAPI Spec**: `http://localhost:3000/docs/json` (raw JSON specification)

### Features

- **Complete API Coverage**: All authentication, user management, role management, permission management, and context management endpoints
- **Interactive Testing**: Use the "Try it out" buttons to test API endpoints directly from the browser
- **Authentication Support**: Includes JWT token authentication with proper security schemes
- **Request/Response Examples**: Detailed examples for all endpoints with proper schemas
- **Error Documentation**: Comprehensive error responses and status codes

### Generating Documentation

```bash
# Generate the OpenAPI specification
npm run swagger:gen

# The specification is automatically generated when running the dev server
npm run dev
```

### Documentation Structure

The API documentation is organized into logical groups:

- **Authentication**: Login, refresh, revoke, password management
- **Users**: User CRUD operations and management
- **Contexts**: Context creation, management, and user membership
- **Roles**: Role management, assignments, and permissions
- **Permissions**: Direct permission grants and effective permission queries

### CORS Configuration

The Swagger UI is configured with proper CORS settings to allow cross-origin requests from:
- `http://localhost:3000` (main API server)
- `http://localhost:5173` (Vite dev server)
- `http://localhost:8080` (additional development ports)

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
   - API Documentation: `http://localhost:3000/docs` (Swagger UI)
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
- **Comprehensive API documentation** with OpenAPI 3.0 specification and Swagger UI integration
- E2E tests for auth/login/refresh, protected routes, role/permission flows, context membership
- Policy overrides for route permissions
- Input validation on all REST endpoints (Zod)
- **Production-ready service layer** with standardized patterns and error handling
- **Service factory** for centralized service management
- **Enhanced CLI** with comprehensive user, permission, and context management
- **Application integration** with convenient service access patterns

Next to consider:
- Better error normalization/translation
- Hierarchical contexts with inheritance
- Prisma migrations for all environments, plus indexes for hot queries
- Rate limiting, password policy, secure reset delivery
- Caching (Redis) for effective permissions and ancestor chains
  - CLI additions (generate-plugin) and docs for Roles API and route-permission matrix
- Proper email implementation for user reset and so on
- Hooks