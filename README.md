# Lattice

> **Lego blocks for access control**

⚠️ **Beta:** Lattice is still evolving. Expect changes in APIs and features before a stable release.

---

## Why Lattice?

Building SaaS apps usually means wrestling with:

* Users in multiple orgs
* Roles that shift across teams, projects, or orgs
* Rules like *“only managers can approve expenses during business hours”*
* That *one extra role* that breaks everything

Traditional patterns often lead to:

* ❌ Hard-coded permission checks everywhere
* ❌ Role hierarchies too messy to maintain
* ❌ Inconsistent security holes
* ❌ Debugging rabbit holes

**Lattice simplifies the model**: permissions are the building block, everything else builds on top.

---

## What You Get

* 🔑 **Permission-first** → one consistent entry point for access decisions
* 🌐 **Context-aware** → orgs, teams, projects, or any custom scope
* ⚡ **Pluggable** → extend with modules, no core rewrites
* 🧩 **Stack-agnostic** → Fastify, Express, Postgres, SQLite
* 🔍 **RBAC + ABAC** → start simple, add complexity only when you need it
* 🚀 **DX-focused** → CLI, TypeScript types, hot reload

---

## 🧠 Mental Model

Every check = `(ActionType:ActionId, ContextType:ContextId)`

* **Permissions** → atomic actions (`users:read`, `projects:create`)
* **Roles** → bundles of permissions, scoped by context
* **Contexts** → the “where” (`org_123`, `team_456`)
* **Context Types** → the shape of the scope (`Organization`, `Team`, `Project`)
* **Policies** → business rules layered on top (e.g. *approve only during business hours*)

🔑 Think of it like this:

* Permissions = building blocks
* Roles = buildings consisting of blocks
* Contexts = towns of buildings
* Policies = traffice rules

---

## 🚀 Quick Start

```bash
npm install @adamelshafei/lattice-core
```

### Setup Database

```bash
# Copy the Prisma schema to your project
cp node_modules/@adamelshafei/lattice-core/prisma/schema.prisma ./prisma/

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

### Use in Your App

```ts
import { Lattice } from '@adamelshafei/lattice-core'

const app = Lattice({
  db: { provider: 'postgres', url: process.env.DATABASE_URL },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d' },
  apiConfig: { apiPrefix: '/api' }
});

  await app.listen(3000);
```

## 🐳 Docker

Use the included `Dockerfile` and `docker-compose.yml` to run Lattice in containers.

1. Copy `.env.example` to `.env` and adjust values as needed.
2. Build and start the services:

```bash
docker compose up --build
```

This launches the app on `http://localhost:3000` with Postgres on `5432` and Redis on `6379`. Remove the `redis` service from `docker-compose.yml` if you don't need it.

---

## 💡 Example

```ts
// Simple RBAC permission check
app.route({
  method: 'GET',
  path: '/users/:id',
  preHandler: app.routeAuth('users:read'),
  handler: async ({ params }) => ({ id: params.id })
});

// ABAC policy: Only resource owners can edit
await app.policyService.createPolicy({
  action: 'documents:edit',
  resource: 'document',
  condition: 'user.id == resource.ownerId',
  effect: 'permit'
});

// Context-aware rule with ABAC
app.route({
  method: 'PUT',
  path: '/teams/:teamId/documents/:docId',
  preHandler: app.routeAuth('documents:edit', { scope: 'exact' }),
  handler: async ({ params }) => {
    // This automatically checks:
    // 1. Does user have 'documents:edit' permission? (RBAC)
    // 2. Does user own this document? (ABAC policy)
    return { updated: params.docId };
  }
});
```

---

## 🛡️ Policy Management

### RBAC + ABAC in Action

Lattice combines **Role-Based** and **Attribute-Based** access control:

```ts
// RBAC: Grant permission to role
await app.roleService.assignPermissionToRole('editor', 'documents:edit');

// ABAC: Add business rules on top
await app.policyService.createPolicy({
  action: 'documents:edit',
  resource: 'document',
  condition: 'user.department == resource.department && time.hour >= 9',
  effect: 'permit'
});

// Result: Users need BOTH the permission AND meet the business rules
```

**Built-in Policy Examples:**

* **Resource ownership**: `user.id == resource.ownerId`
* **Business hours**: `time.hour >= 9 && time.hour <= 17`
* **Department access**: `user.department == resource.department`
* **Manager approval**: `user.role == "manager" && resource.amount <= user.approvalLimit`

### Route Permissions

Lattice protects every built‑in route with a permission rule:

```ts
defaultRoutePermissionPolicy = {
  roles: { create: 'roles:{type}:create', assign: 'roles:assign:{type}' },
  users: { list: 'users:read', delete: 'users:delete' },
  contexts: { create: 'contexts:create', addUser: 'contexts:assign' }
};
```

Override defaults when creating the app:

```ts
const app = Lattice({
  policy: {
    users: { list: 'users:list' }  // Custom permission
  }
});
```

---

## 🤝 Contributing

We’re aiming to make access control less painful and more fun to work with.
Whether it’s a bug, feature, or idea contributions are welcome.
