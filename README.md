# 🏗️ Lattice

> **Lego blocks for access control**

> ⚠️ **Beta Notice:** Lattice is currently in beta. A production-ready release is planned for the future, and APIs or features may change.

Ever built a SaaS app and got lost in a maze of roles and permissions? Lattice is here to save you from auth spaghetti.

Lattice is a permission-first backend framework that makes complex authorization feel simple. Think of it as the foundation that handles all your "who can do what where" logic, so you can focus on building features that matter.

## Why Lattice?

Building SaaS apps means dealing with complex permission scenarios:
- Users who belong to multiple organizations
- Roles that change based on context (team vs org vs project)
- Business rules like "only managers can approve expenses during business hours"
- The inevitable "just one more role" that breaks your entire auth system

Traditional approaches lead to:
- 🔴 Hard-coded permission checks scattered throughout your codebase
- 🔴 Complex role hierarchies that become impossible to maintain
- 🔴 Security vulnerabilities from inconsistent authorization logic
- 🔴 Hours spent debugging "why can't this user access that?"

Lattice solves this by putting permissions at the center of your architecture, not as an afterthought.

## ✨ What Makes Lattice Great

🔑 **Permission-first design** - Every action flows through a unified permission system

🌐 **Context-aware** - Permissions that adapt to organizations, teams, and projects

⚡️ **Pluggable modules** - Add features without touching core auth logic

🧩 **Works with your stack** - Fastify, Express, PostgreSQL, SQLite - your choice

🔍 **RBAC + ABAC** - Start simple with roles, add complex policies when needed

🚀 **Developer experience** - CLI tools, TypeScript types, hot-reloadable permissions

📚 **Built-in APIs** - Complete REST API with OpenAPI documentation

## 🚀 Quick Start

Get Lattice running in 3 steps:

### 1. Install & Setup

```bash
npm install lattice-core

# Set up your environment
export DATABASE_URL="postgresql://user:password@localhost:5432/lattice"
export JWT_SECRET="your-super-secret-key"

# Initialize database
npx prisma generate
npx prisma db push
```

### 2. Create Your App

```typescript
import { Lattice } from 'lattice-core';

const app = Lattice({
  db: { provider: 'postgres', url: process.env.DATABASE_URL },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d' },
  exposeAPI: true
});

await app.listen(3000);
console.log('🚀 Lattice running on port 3000');
```

### 3. Use Authorization in Your Routes

```typescript
// Simple permission check
app.route({
  method: 'GET',
  path: '/users/:id',
  preHandler: app.routeAuth('users:read'),
  handler: async ({ params }) => {
    return { id: params.id, name: 'John Doe' };
  }
});

// Context-aware permission check
app.route({
  method: 'POST',
  path: '/teams/:teamId/users',
  preHandler: app.routeAuth('users:create', { scope: 'exact' }),
  handler: async ({ params }) => {
    // User can only create users in their team
    return { success: true };
  }
});
```

That's it! Your app now has enterprise-grade authorization without the enterprise complexity.

## 🧠 Mental Model

In Lattice, every authorization check boils down to:
**(PermissionType\:PermissionId, ContextType\:ContextId)**

* **Permissions** → the smallest building block. Tuples like `users:read`, `projects:create`, `expenses:approve`.
* **Roles** → named bundles of permissions. Example: `admin = [users:manage, roles:manage]`. Roles by themselves aren’t scoped, they gain meaning when tied to a context.
* **Contexts** → the *where*. A scope like `org_123`, `team_456`, `project_789`. A user’s role always lives *inside* a context.
* **Context Types** → the shape of the scope. Examples: `Organization`, `Team`, `Project`. Each can have its own relevant permissions.
* **Policies** → business rules that go beyond static permissions. Example: “only managers can approve expenses *during business hours*.”

---

🔑 Think of it like this:

* **Permissions** are bricks.
* **Roles** are building blueprints.
* **Contexts** are towns where those buildings live.
* **Policies** are house rules that decide *when* and *how* those buildings can be used.

## 💡 Usage Examples

### Basic Permission Check

```typescript
// Check if user can read a specific user
const canRead = await app.checkAccess({
  userId: 'alice',
  context: { type: 'organization', id: 'org_123' },
  permission: 'users:read',
  scope: 'exact'
});
```

### Complex Business Rules

```typescript
// Create a policy: "Only managers can approve expenses during business hours"
await app.policyService.createPolicy({
  action: 'expenses:approve',
  resource: 'expense',
  condition: 'user.role == "manager" && time.hour >= 9 && time.hour <= 17',
  effect: 'permit'
});

// The policy automatically applies to all expense approval requests
```

### Multi-tenant Contexts

```typescript
// Grant permissions in different contexts
await app.permissionService.grantToUser({
  userId: 'alice',
  permissionKey: 'users:read',
  contextId: 'org_123'  // Can read users in org_123
});

await app.permissionService.grantToUser({
  userId: 'alice',
  permissionKey: 'projects:create',
  contextId: 'team_456'  // Can create projects in team_456
});
```

## 🔧 Core Features

### Built-in REST APIs

Lattice comes with complete APIs for user management, roles, permissions, and contexts:

```bash
# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@company.com", "password": "secure123"}'

# Grant permission
curl -X POST http://localhost:3000/api/permissions/user/grant \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userId": "alice", "permissionKey": "users:read", "contextId": "org_123"}'
```

### CLI Tools

Manage your authorization system from the command line:

```bash
# List all permissions
npx lattice list-permissions

# Create a user
npx lattice users:create --email alice@company.com --password secure123

# Grant permission
npx lattice permissions:grant --userId alice --permission users:read --contextId org_123

# Check access
npx lattice check-access --userId alice --contextId org_123 --permission users:read
```

### Plugin System

Extend Lattice with domain-specific functionality:

```typescript
const TeamsPlugin = {
  name: 'teams',
  permissions: [
    { key: 'teams:create', label: 'Create teams' },
    { key: 'teams:join', label: 'Join teams' }
  ],
  register: (app) => {
    // Add your team management logic
  }
};

app.registerPlugin(TeamsPlugin);
```

## 🛡️ Security Features

- **JWT-based authentication** with refresh tokens
- **Password hashing** with bcrypt
- **Token revocation** for secure logout
- **Rate limiting** on authentication endpoints
- **CORS protection** with configurable origins
- **Input validation** with Zod schemas
- **Audit logging** for all authorization decisions

## 🚀 Getting Started with Your Project

### 1. Choose Your Database

```typescript
// PostgreSQL (recommended for production)
const app = Lattice({
  db: { provider: 'postgres', url: process.env.DATABASE_URL }
});

// SQLite (great for development)
const app = Lattice({
  db: { provider: 'sqlite', url: 'file:./dev.db' }
});
```

### 2. Pick Your HTTP Framework

```typescript
// Fastify (recommended)
const app = Lattice({ adapter: 'fastify' });

// Express
const app = Lattice({ adapter: 'express' });
```

### 3. Configure Your Environment

```env
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/lattice"
JWT_SECRET="your-super-secret-jwt-key"

# Optional
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
PORT="3000"
```
## 🤝 Contributing

We’re building Lattice to simplify access control and help devs move faster. This only works with community input so whether you’re reporting a bug, requesting a feature or sharing feedback we’d love to have you involved.

**How to contribute:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Submit a pull request

**We welcome:**
- 🐛 Bug reports and fixes
- ✨ New features and improvements
- 📚 Documentation improvements
- 💡 Ideas and suggestions
- 🌟 Star the repo if you find it useful!

## 🗺️ Vision & Roadmap

Lattice is evolving from a solid RBAC foundation to a comprehensive ABAC platform. Here's where we're headed:

**Now (v0.1.x):**
- ✅ Core RBAC with context awareness
- ✅ Basic ABAC policy engine
- ✅ Plugin architecture
- ✅ Production-ready service layer

**Next:**
- 🔄 Enterprise features (SSO, audit trails, compliance)
- 🔄 Advanced ABAC
- 🔄 Policy versioning and rollback
- 🔄 Performance optimizations and caching

**Future:**
- 🚀 Plugins! (Teams, Billing, Analytics)
- 🚀 Visual policy editor
- 🚀 Cloud-hosted Lattice service

**The goal:** building a flexible, open framework for access control that developers actually love to use.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Prisma](https://www.prisma.io/) for type-safe database access
- [Fastify](https://www.fastify.io/) and [Express](https://expressjs.com/) for HTTP frameworks
- [CEL](https://github.com/google/cel-js) for policy evaluation
- [OpenAPI](https://swagger.io/specification/) for API documentation

---

<div align="center">
  <strong>Built with ❤️ for developers who deserve better auth</strong>
</div>
