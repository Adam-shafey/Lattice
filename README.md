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

---

## 💡 Example

```ts
// Route with a simple permission
app.route({
  method: 'GET',
  path: '/users/:id',
  preHandler: app.routeAuth('users:read'),
  handler: async ({ params }) => ({ id: params.id })
});

// Context-aware rule
app.route({
  method: 'POST',
  path: '/teams/:teamId/users',
  preHandler: app.routeAuth('users:create', { scope: 'exact' }),
  handler: async () => ({ success: true })
});
```

---

## 🛡️ Policy Management

Lattice protects every built‑in route with a permission rule.  
The `defaultRoutePermissionPolicy` maps common actions to the permissions they require, like:

```ts
defaultRoutePermissionPolicy = {
  roles: { create: 'roles:{type}:create', assign: 'roles:assign:{type}' },
  users: { list: 'users:read', delete: 'users:delete' },
  contexts: { create: 'contexts:create', addUser: 'contexts:assign' }
};
```

To customize these requirements, pass a partial policy when creating the app.  
Any fields you provide override the defaults:

```ts
import { Lattice } from '@adamelshafei/lattice-core';

const app = Lattice({
  /* ... */
  policy: {
    users: { list: 'users:list' }
  }
});
```

You can also build a complete policy separately:

```ts
import { createRoutePermissionPolicy } from '@adamelshafei/lattice-core';

const policy = createRoutePermissionPolicy({
  users: { delete: 'users:terminate' }
});
```

---

## 🤝 Contributing

We’re aiming to make access control less painful and more fun to work with.
Whether it’s a bug, feature, or idea contributions are welcome.
