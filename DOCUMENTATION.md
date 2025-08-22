# 🏗️ Lattice Core Documentation

> **The Permission-First Backend Framework**

> ⚠️ **Beta Release:** Lattice Core is currently in beta. A production-ready release is planned for the future, and interfaces may change.

## Introduction

Lattice Core is a modular, permission-first backend framework designed to solve the complex authorization challenges that modern SaaS applications face. Unlike traditional frameworks that bolt on authentication and authorization as an afterthought, Lattice puts permissions at the center of your application architecture.

### Why Lattice Exists

Modern applications need to handle:
- **Multi-tenant architectures** with complex organizational hierarchies
- **Fine-grained permissions** that go beyond simple role-based access
- **Dynamic policy evaluation** based on user attributes, resource properties, and environmental factors
- **Modular extensibility** without tightly coupling business logic to authorization concerns

Lattice solves these problems by providing a unified mental model where every action flows through a permission system that combines Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC).

### What Problems Does Lattice Solve?

1. **Permission Sprawl**: Traditional RBAC systems become unwieldy as applications grow
2. **Context Complexity**: Multi-tenant apps struggle with scoping permissions across organizations, teams, and projects
3. **Policy Management**: Hard-coded authorization logic scattered throughout codebases
4. **Attribute-Based Decisions**: Simple roles can't handle complex business rules like "only resource owners can edit during business hours"

## Core Mental Model

Lattice's mental model revolves around five core concepts that work together to create a flexible, powerful authorization system.

### Users

Users in Lattice are simple entities with a unique identifier and email. They serve as the subject in authorization decisions.

```typescript
// Users are created with secure password hashing
const user = await app.userService.createUser({
  email: 'alice@company.com',
  password: 'securepassword123',
  context: { actorId: 'system' }
});
```

Users don't have permissions directly—instead, they receive permissions through roles or direct grants, always scoped to specific contexts.

### Permissions

Permissions are fine-grained action strings that follow a hierarchical pattern. Think of them as the "verbs" in your authorization system.

```typescript
// Permission examples
'users:read'           // Read user data
'users:write'          // Modify user data
'users:delete'         // Delete users
'org:123:users:read'   // Read users in specific organization
'*'                    // All permissions (super admin)
```

**Permission Hierarchy:**
- `*` - Wildcard for all permissions
- `users:*` - All user-related permissions
- `users:read` - Specific user read permission
- `org:123:users:read` - Context-specific permission

### Roles

Roles are collections of permissions that can be assigned to users. They provide a way to group related permissions together.

```typescript
// Create a role for team managers
const managerRole = await app.roleService.createRole({
  name: 'team-manager',
  contextType: 'team',
  context: { actorId: 'admin' }
});

// Add permissions to the role
await app.roleService.addPermissionToRole({
  roleName: 'team-manager',
  permissionKey: 'users:read',
  contextType: 'team'
});

// Assign role to user in specific context
await app.roleService.assignRoleToUser({
  roleName: 'team-manager',
  userId: 'alice',
  contextId: 'team_456',
  contextType: 'team',
  context: { actorId: 'admin' }
});
```

### Contexts

Contexts are the "where" in your authorization decisions. They scope permissions to specific organizational boundaries.

```typescript
// Create organizational contexts
await app.contextService.createContext({
  id: 'org_123',
  type: 'organization',
  name: 'Acme Corp',
  context: { actorId: 'system' }
});

await app.contextService.createContext({
  id: 'team_456',
  type: 'team',
  name: 'Engineering',
  context: { actorId: 'admin' }
});
```

**Context Hierarchy:**
- **Global**: Permissions that apply everywhere
- **Type-wide**: Permissions that apply to all contexts of a specific type
- **Context-specific**: Permissions that apply only to a specific context

### Policies

Policies combine RBAC and ABAC to make sophisticated authorization decisions. They evaluate conditions based on user attributes, resource properties, and environmental factors.

```typescript
// Create an ABAC policy
await app.policyService.createPolicy({
  action: 'users:edit',
  resource: 'user',
  condition: 'user.department == resource.department && time.hour >= 9 && time.hour <= 17',
  effect: 'permit',
  context: { actorId: 'admin' }
});
```

**Policy Components:**
- **Action**: What the user is trying to do
- **Resource**: What they're trying to do it to
- **Condition**: CEL expression that evaluates to true/false
- **Effect**: `permit` or `deny`

## Authorization Flow

Lattice evaluates every protected request through a layered process:

1. **Route middleware** (`app.routeAuth` or `authorize`): extracts the user ID and context from headers, params, query, or body. It can enforce that a request is global, type-wide, or scoped to an exact context before your handler runs.
2. **`checkAccess`**: builds the lookup context and loads the user's *effective permissions*—direct grants merged with role‑based permissions. The `PermissionRegistry` checks for the required permission, including wildcard patterns like `users:*`.
3. **ABAC policies**: if the RBAC check passes, matching Attribute-Based policies are evaluated. Access is granted only when both RBAC and ABAC return `permit`.

Roles are context-aware. Assigning a role in a context whose type doesn't match the role's declared context type results in a validation error, keeping permissions consistent across organizations, teams, and projects.

### Example Scenarios

- **Context-specific role vs. user grant**: A `viewer` role with `example:read` in `ctx_1` allows reads only in that context; a direct grant of `example:write` in `ctx_2` allows writes there.
- **Context-type validation**: Assigning a role defined for `org` to a `team` context is rejected.
- **Global and type-wide permissions**: A global permission works across all contexts, while a type-wide permission such as `team:read` applies to every `team` context but not to `org` contexts.

## Policy Management

### Route Permission Policy

Every HTTP endpoint exposed by Lattice requires a specific permission.  
The `defaultRoutePermissionPolicy` describes these defaults:

```ts
export const defaultRoutePermissionPolicy = {
  roles: {
    create: 'roles:{type}:create',
    list: 'roles:{type}:list',
    get: 'roles:{type}:read',
    delete: 'roles:{type}:delete',
    manage: 'roles:{type}:manage',
    assign: 'roles:assign:{type}',
    remove: 'roles:remove:{type}',
    addPerm: {
      roleManage: 'roles:{type}:manage',
      permissionGrant: 'permissions:{perm}:grant:{type}',
    },
    removePerm: {
      roleManage: 'roles:{type}:manage',
      permissionRevoke: 'permissions:{perm}:revoke:{type}',
    },
  },
  users: {
    create: 'users:create',
    list: 'users:read',
    get: 'users:read',
    update: 'users:update',
    delete: 'users:delete',
  },
  permissions: {
    grantUser: 'permissions:grant',
    revokeUser: 'permissions:revoke',
  },
  contexts: {
    create: 'contexts:create',
    get: 'contexts:read',
    update: 'contexts:update',
    delete: 'contexts:delete',
    addUser: 'contexts:assign',
    removeUser: 'contexts:assign',
  },
};
```

You can replace parts of this policy when instantiating `Lattice`:

```ts
import { Lattice } from 'lattice-core';

const app = Lattice({
  /* other config */, 
  policy: {
    users: { delete: 'users:terminate' }
  }
});
```

For composition outside of the constructor, use the helpers:

```ts
import {
  createRoutePermissionPolicy,
  validateRoutePermissionPolicy,
} from 'lattice-core';

const policy = createRoutePermissionPolicy({
  roles: { create: 'roles:{type}:make' }
});

const errors = validateRoutePermissionPolicy(policy); // []
```

These helpers merge your overrides with the defaults and check for missing
permissions, giving you full control over how routes are secured.

### How Policies Work

Policies in Lattice follow a clear lifecycle:

1. **Definition**: Policies are defined using CEL (Common Expression Language)
2. **Storage**: Policies are stored in the database with versioning
3. **Caching**: Policies are cached for performance (30-second TTL)
4. **Evaluation**: Policies are evaluated at runtime with current attributes
5. **Auditing**: All decisions are logged for compliance

### Policy Evaluation Flow

```typescript
// When a user tries to access a resource
const hasAccess = await app.checkAccess({
  userId: 'alice',
  context: { type: 'organization', id: 'org_123' },
  permission: 'users:edit',
  scope: 'exact'
});
```

**What happens internally:**
1. **RBAC Check**: Gather all user permissions (direct + role-based)
2. **Permission Match**: Check if user has the required permission
3. **ABAC Evaluation**: Evaluate all matching policies with current attributes
4. **Decision**: Combine RBAC and ABAC results (deny overrides permit)

### Attribute Providers

Attribute providers collect the data needed for policy evaluation. Lattice provides a default provider that you can extend.

```typescript
// Default attribute provider
class DefaultAttributeProvider implements AttributeProvider {
  async getUserAttributes(userId: string): Promise<Record<string, any>> {
    return { id: userId };
  }
  
  async getResourceAttributes(resource: { type: string; id: string | null }): Promise<Record<string, any>> {
    return resource ? { ...resource } : {};
  }
  
  async getEnvironmentAttributes(): Promise<Record<string, any>> {
    return { time: new Date().toISOString() };
  }
}
```

**Available Attributes:**
- **User**: `user.id`, `user.email`, `user.department`, etc.
- **Resource**: `resource.type`, `resource.id`, `resource.owner`, etc.
- **Environment**: `time`, `location`, `device`, etc.

## Modules

Lattice follows a modular architecture where the core provides the authorization foundation, and plugins add domain-specific functionality.

### Core Module (Included)

The core module provides:
- **Authentication**: JWT-based auth with refresh tokens
- **User Management**: CRUD operations for users
- **Role Management**: Role creation, assignment, and permission management
- **Context Management**: Multi-tenant context resolution
- **Policy Engine**: ABAC policy evaluation
- **Permission Registry**: Permission registration and wildcard matching

### Plugin System

Plugins extend Lattice with domain-specific functionality:

```typescript
// Example plugin structure
const TeamsPlugin = {
  name: 'teams',
  permissions: [
    { key: 'teams:create', label: 'Create teams' },
    { key: 'teams:join', label: 'Join teams' },
    { key: 'teams:leave', label: 'Leave teams' }
  ],
  register: (app: LatticeCore) => {
    // Register routes, add business logic
  }
};

app.registerPlugin(TeamsPlugin);
```

**Common Plugin Types:**
- **Teams**: Team management and membership
- **Uploads**: File upload and storage
- **Billing**: Subscription and payment management
- **Analytics**: Data collection and reporting

## Installation & Setup

### Quick Start

```bash
# Install Lattice
npm install @yourorg/lattice-core

# Set up environment
export DATABASE_URL="postgresql://user:password@localhost:5432/lattice"
export JWT_SECRET="your-super-secret-jwt-key"

# Initialize database
npx prisma generate
npx prisma db push

# Seed with sample data
npx prisma db seed
```

### Basic Configuration

```typescript
import { Lattice } from '@yourorg/lattice-core';

const app = Lattice({
  db: { 
    provider: 'postgres', 
    url: process.env.DATABASE_URL 
  },
  adapter: 'fastify', // or 'express'
  jwt: {
    accessTTL: '15m',
    refreshTTL: '7d',
    secret: process.env.JWT_SECRET
  },
  apiConfig: { apiPrefix: '/api/v1' } // Built-in REST APIs exposed by default
});

await app.listen(3000);
```

## Usage Examples

### Checking Permissions in Route Handlers

```typescript
// Simple permission check
app.route({
  method: 'GET',
  path: '/users/:id',
  preHandler: app.routeAuth('users:read'),
  handler: async ({ params, user }) => {
    const userId = params.id;
    // Your business logic here
    return { id: userId, name: 'John Doe' };
  }
});

// Context-aware permission check
app.route({
  method: 'POST',
  path: '/teams/:teamId/users',
  preHandler: app.routeAuth('users:create', { scope: 'exact' }),
  handler: async ({ params, body, user }) => {
    const teamId = params.teamId;
    // User can only create users in their team
    return { success: true };
  }
});
```

### Adding ABAC Policies

```typescript
// Business hours policy
await app.policyService.createPolicy({
  action: 'users:edit',
  resource: 'user',
  condition: 'time.hour >= 9 && time.hour <= 17',
  effect: 'permit',
  context: { actorId: 'admin' }
});

// Resource ownership policy
await app.policyService.createPolicy({
  action: 'documents:edit',
  resource: 'document',
  condition: 'user.id == resource.ownerId',
  effect: 'permit',
  context: { actorId: 'admin' }
});

// Department-based policy
await app.policyService.createPolicy({
  action: 'reports:view',
  resource: 'report',
  condition: 'user.department == resource.department',
  effect: 'permit',
  context: { actorId: 'admin' }
});
```

### Using Contexts

```typescript
// Organization-level permissions
await app.permissionService.grantToUser({
  userId: 'alice',
  permissionKey: 'users:read',
  contextId: 'org_123',
  context: { actorId: 'admin' }
});

// Team-level permissions
await app.permissionService.grantToUser({
  userId: 'bob',
  permissionKey: 'projects:create',
  contextId: 'team_456',
  context: { actorId: 'admin' }
});

// Global permissions
await app.permissionService.grantToUser({
  userId: 'admin',
  permissionKey: '*',
  context: { actorId: 'system' }
});
```

### Combining RBAC and ABAC

```typescript
// Check access with both RBAC and ABAC
const hasAccess = await app.checkAccess({
  userId: 'alice',
  context: { type: 'organization', id: 'org_123' },
  permission: 'users:edit',
  scope: 'exact'
});

// This evaluates:
// 1. Does Alice have 'users:edit' permission in org_123? (RBAC)
// 2. Do any ABAC policies permit/deny this action? (ABAC)
// 3. Final decision: deny overrides permit
```

## Creating Your Own Policy

### Step-by-Step Policy Creation

**1. Define the Target**
```typescript
// What action and resource are we protecting?
const action = 'expenses:approve';
const resource = 'expense';
```

**2. Write Conditions with CEL**
```typescript
// CEL expression examples
const conditions = {
  // Only managers can approve
  'user.role == "manager"',
  
  // Only within approval limit
  'resource.amount <= user.approvalLimit',
  
  // Only during business hours
  'time.hour >= 9 && time.hour <= 17',
  
  // Only for their department
  'user.department == resource.department'
};
```

**3. Decide on Effect**
```typescript
// Permit or deny
const effect = 'permit'; // or 'deny'
```

**4. Create the Policy**
```typescript
await app.policyService.createPolicy({
  action: 'expenses:approve',
  resource: 'expense',
  condition: 'user.role == "manager" && resource.amount <= user.approvalLimit',
  effect: 'permit',
  context: { actorId: 'admin' }
});
```

**5. Test the Policy**
```typescript
// Test with different scenarios
const testCases = [
  { userId: 'manager1', amount: 1000, expected: true },
  { userId: 'employee1', amount: 100, expected: false },
  { userId: 'manager1', amount: 5000, expected: false }
];

for (const test of testCases) {
  const result = await app.checkAccess({
    userId: test.userId,
    context: { type: 'organization', id: 'org_123' },
    permission: 'expenses:approve'
  });
  console.log(`Test: ${result === test.expected ? 'PASS' : 'FAIL'}`);
}
```

## How Policy Management Works

### Policy Lifecycle

```mermaid
graph TD
    A[Policy Defined] --> B[Stored in DB]
    B --> C[Cached in Memory]
    C --> D[Evaluated at Runtime]
    D --> E[Decision Made]
    E --> F[Audit Logged]
    F --> G[Response Returned]
```

### PAP, PDP, and PEP Layers

**Policy Administration Point (PAP)**
- Where policies are created, updated, and deleted
- Handled by the `PolicyService`

**Policy Decision Point (PDP)**
- Where authorization decisions are made
- Combines RBAC and ABAC evaluation

**Policy Enforcement Point (PEP)**
- Where policies are enforced in your application
- Route middleware and `checkAccess` calls

### Caching Strategy

```typescript
// Policies are cached with 30-second TTL
let cache: { policies: AbacPolicy[]; expiry: number } | null = null;

async function loadPolicies(service: IPolicyService): Promise<AbacPolicy[]> {
  const now = Date.now();
  if (!cache || now > cache.expiry) {
    const policies = await service.listPolicies();
    cache = { policies, expiry: now + 30000 }; // 30s TTL
  }
  return cache.policies;
}
```

## Permissions & Context Management

### Designing Permission Keys

**Best Practices:**
```typescript
// Good: Hierarchical and descriptive
'users:read'
'users:write'
'users:delete'
'org:123:users:read'
'team:456:projects:create'

// Avoid: Flat and unclear
'can_read_users'
'user_access'
'org_user_read'
```

**Permission Patterns:**
```typescript
// Resource:Action pattern
'users:read'
'projects:create'
'documents:update'

// Context:Resource:Action pattern
'org:123:users:read'
'team:456:projects:create'

// Wildcard patterns
'users:*'           // All user permissions
'org:123:*'         // All permissions in org
'*'                 // All permissions
```

### Wildcard and Hierarchy Resolution

```typescript
// Wildcard matching examples
const userPermissions = new Set([
  'users:read',
  'users:write',
  'org:123:*'
]);

// These will match:
permissionRegistry.isAllowed('users:read', userPermissions);     // true
permissionRegistry.isAllowed('users:delete', userPermissions);   // false
permissionRegistry.isAllowed('org:123:projects:create', userPermissions); // true (via wildcard)
```

### Context Scoping Resolution

```typescript
// Context resolution order
const context = resolveContext({
  routeParam: 'org_123',      // Highest priority
  header: 'x-context-id',     // Medium priority
  query: 'contextId'          // Lowest priority
});

// Scoping examples
const scopes = {
  global: null,                    // No context
  typeWide: { type: 'org', id: null }, // All orgs
  exact: { type: 'org', id: 'org_123' } // Specific org
};
```

## Advanced Topics

### Attribute Provenance

Lattice tracks where attributes come from for audit purposes:

```typescript
// Custom attribute provider with provenance
class CustomAttributeProvider implements AttributeProvider {
  async getUserAttributes(userId: string): Promise<Record<string, any>> {
    const user = await getUserFromDatabase(userId);
    return {
      id: userId,
      department: user.department,
      role: user.role,
      _provenance: {
        source: 'database',
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };
  }
}
```

### Caching Strategy

Lattice uses a multi-level caching strategy:

1. **Policy Cache**: 30-second TTL for ABAC policies
2. **Permission Cache**: In-memory permission registry
3. **Effective Permissions**: Calculated on-demand with context

```typescript
// Cache invalidation
export function invalidatePolicyCache() {
  cache = null; // Force reload on next access
}

// Called automatically when policies change
await app.policyService.createPolicy(policy);
// Cache is automatically invalidated
```

### Deny Overrides Logic

Lattice follows a deny-overrides model:

```typescript
// Policy evaluation logic
let permit = false;
for (const policy of relevant) {
  const result = evaluate(policy.condition, attrs);
  if (result) {
    if (policy.effect === 'deny') {
      return false; // Deny immediately overrides everything
    }
    if (policy.effect === 'permit') {
      permit = true; // At least one permit needed
    }
  }
}
return permit;
```

### Default Decision Behavior

When no policies match, Lattice defaults to **allow** for backward compatibility:

```typescript
// Default behavior
if (relevant.length === 0) {
  logger.log('🛡️ [ABAC] No policies matched - default allow');
  return true; // maintain backward compatibility
}
```

## Best Practices

### Structuring Permissions

**1. Use Hierarchical Naming**
```typescript
// Good
'users:read'
'users:write'
'users:delete'
'org:123:users:read'

// Avoid
'can_read_users'
'user_access'
'org_user_read'
```

**2. Leverage Wildcards Strategically**
```typescript
// Grant broad permissions to admins
await app.permissionService.grantToUser({
  userId: 'admin',
  permissionKey: '*',
  context: { actorId: 'system' }
});

// Grant specific permissions to regular users
await app.permissionService.grantToUser({
  userId: 'user',
  permissionKey: 'users:read',
  contextId: 'org_123',
  context: { actorId: 'admin' }
});
```

**3. Use Contexts for Multi-tenancy**
```typescript
// Organization-level permissions
'org:123:users:read'
'org:123:projects:create'

// Team-level permissions
'team:456:members:manage'
'team:456:resources:access'
```

### Avoiding Policy Sprawl

**1. Group Related Policies**
```typescript
// Instead of many small policies
'users:read:business_hours'
'users:read:same_department'
'users:read:manager_approval'

// Use one comprehensive policy
'users:read' with condition: 
  '(time.hour >= 9 && time.hour <= 17) && 
   (user.department == resource.department || user.role == "manager")'
```

**2. Use Roles for Common Patterns**
```typescript
// Create roles for common permission sets
const viewerRole = await app.roleService.createRole({
  name: 'viewer',
  contextType: 'organization'
});

await app.roleService.addPermissionToRole({
  roleName: 'viewer',
  permissionKey: 'users:read',
  contextType: 'organization'
});
```

**3. Leverage Inheritance**
```typescript
// Use wildcards for hierarchical permissions
'org:123:*'  // All permissions in organization
'team:456:projects:*'  // All project permissions in team
```

### Handling Multi-tenant Contexts

**1. Clear Context Hierarchy**
```typescript
// Define clear context types
const contextTypes = {
  organization: 'org',
  team: 'team',
  project: 'project',
  workspace: 'workspace'
};
```

**2. Context Resolution Strategy**
```typescript
// Resolve context from request
const context = app.contextService.resolveContext({
  routeParam: req.params.contextId,
  header: req.headers['x-context-id'],
  query: req.query.contextId
});
```

**3. Cross-Context Permissions**
```typescript
// Handle permissions that span contexts
await app.permissionService.grantToUser({
  userId: 'admin',
  permissionKey: 'users:read',
  contextType: 'organization', // Type-wide permission
  context: { actorId: 'system' }
});
```

### Writing Clear Policies

**1. Use Descriptive CEL Expressions**
```typescript
// Good: Clear and readable
condition: 'user.role == "manager" && resource.amount <= user.approvalLimit'

// Avoid: Complex and unclear
condition: 'u.r == "m" && r.a <= u.al'
```

**2. Test Policies Thoroughly**
```typescript
// Test policy with various scenarios
const testScenarios = [
  { user: { role: 'manager', approvalLimit: 1000 }, resource: { amount: 500 }, expected: true },
  { user: { role: 'employee', approvalLimit: 100 }, resource: { amount: 500 }, expected: false },
  { user: { role: 'manager', approvalLimit: 1000 }, resource: { amount: 1500 }, expected: false }
];
```

**3. Document Policy Intent**
```typescript
// Add comments or metadata to policies
await app.policyService.createPolicy({
  action: 'expenses:approve',
  resource: 'expense',
  condition: 'user.role == "manager" && resource.amount <= user.approvalLimit',
  effect: 'permit',
  context: { actorId: 'admin' }
  // Policy: Managers can approve expenses up to their approval limit
});
```

## FAQ / Mental Pitfalls

### Why Did My Policy Not Apply?

**Common Causes:**

1. **Permission Mismatch**
```typescript
// Policy action doesn't match permission check
// Policy: action: 'users:edit'
// Check: permission: 'users:update'  // ❌ Mismatch
```

2. **Context Mismatch**
```typescript
// Policy scoped to different context
// Policy: resource: 'user' (global)
// Check: context: { type: 'org', id: 'org_123' }  // ❌ Context mismatch
```

3. **Condition Always False**
```typescript
// Check your CEL expression
condition: 'user.role == "manager"'  // Is user.role actually "manager"?
```

**Debugging Steps:**
```typescript
// Enable debug logging
logger.log('🔍 [CHECK_ACCESS] Input:', input);
logger.log('🔍 [CHECK_ACCESS] Effective permissions:', Array.from(effective));
logger.log('🔍 [CHECK_ACCESS] ABAC evaluation result:', abacAllowed);
```

### What Happens If an Attribute Is Missing?

**Default Behavior:**
```typescript
// Missing attributes evaluate to null/false
condition: 'user.department == resource.department'
// If user.department is missing → condition evaluates to false
```

**Best Practice:**
```typescript
// Handle missing attributes explicitly
condition: 'user.department != null && user.department == resource.department'
```

### How Do RBAC and ABAC Interact?

**Interaction Flow:**
1. **RBAC First**: Check if user has the permission
2. **ABAC Second**: Evaluate policies if RBAC passes
3. **Deny Overrides**: Any ABAC deny overrides RBAC permit

**Example:**
```typescript
// User has RBAC permission 'users:edit'
// But ABAC policy denies during off-hours
const hasAccess = await app.checkAccess({
  userId: 'alice',
  permission: 'users:edit',
  context: { type: 'org', id: 'org_123' }
});
// Result: false (ABAC deny overrides RBAC permit)
```

### Performance Considerations

**1. Permission Caching**
```typescript
// Effective permissions are calculated on-demand
// Consider caching for high-frequency checks
const cacheKey = `${userId}-${contextId}`;
let cachedPermissions = permissionCache.get(cacheKey);
if (!cachedPermissions) {
  cachedPermissions = await fetchEffectivePermissions(userId, context);
  permissionCache.set(cacheKey, cachedPermissions, 300000); // 5 minutes
}
```

**2. Policy Evaluation**
```typescript
// Policies are cached for 30 seconds
// Heavy CEL expressions can impact performance
// Consider simplifying complex conditions
```

**3. Database Queries**
```typescript
// Use database indexes on permission tables
// Consider denormalization for frequently accessed data
```

### Security Best Practices

**1. Principle of Least Privilege**
```typescript
// Grant minimal permissions needed
await app.permissionService.grantToUser({
  userId: 'user',
  permissionKey: 'users:read', // Not 'users:*'
  contextId: 'org_123',
  context: { actorId: 'admin' }
});
```

**2. Regular Permission Audits**
```typescript
// Review and clean up unused permissions
const userPermissions = await app.permissionService.getUserPermissions({
  userId: 'user',
  contextId: 'org_123'
});
```

**3. Secure Policy Conditions**
```typescript
// Avoid user-controlled input in conditions
// Good: condition: 'user.role == "manager"'
// Bad: condition: `user.role == "${userInput}"`
```
