# Lattice Core Services - Complete Usage Guide


## Table of Contents

1. [Getting Started](#getting-started)
2. [Service Factory](#service-factory)
3. [Application Integration](#application-integration)
4. [CLI Usage](#cli-usage)
6. [Context Service](#context-service)
7. [Role Service](#role-service)
8. [User Service](#user-service)
9. [User Permission Service](#user-permission-service)
10. [Error Handling](#error-handling)
11. [Best Practices](#best-practices)
12. [Common Patterns](#common-patterns)

## Getting Started

### Initialization

```typescript
import { ServiceFactory } from './src/core/services';
import { db } from './src/core/db/db-client';

// Initialize the service factory
const factory = new ServiceFactory({
  db,
    enabled: true,
    sinks: ['db', 'stdout'],
    batchSize: 100,
    flushInterval: 5000,
    redactKeys: ['password', 'token']
  }
});

// Access all services
const contextService = factory.getContextService();
const roleService = factory.getRoleService();
const permissionService = factory.getPermissionService();
const userService = factory.getUserService();
```

### Service Context


```typescript
const serviceContext = {
  actorId: 'user_123',
  requestId: 'req_456',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
};
```

## Service Factory

The `ServiceFactory` manages all service instances and provides centralized access.

### Methods

#### `getContextService(): IContextService`
Returns the context service instance.

#### `getRoleService(): IRoleService`
Returns the role service instance.

#### `getPermissionService(): IPermissionService`
Returns the permission service instance.

#### `getUserService(): IUserService`
Returns the user service instance.

#### `getAllServices(): Record<string, any>`
Returns all service instances for debugging/testing.

#### `shutdown(): Promise<void>`

#### `reset(): void`
Resets all service instances (useful for testing).

### Global Access

```typescript
import { getServiceFactory, setServiceFactory } from './src/core/services';

// Set global factory
setServiceFactory(factory);

// Get global factory
const globalFactory = getServiceFactory();
const roleService = globalFactory.getRoleService();
```

## Application Integration

### Main Application (index.ts)

The main application has been refactored to use the new service patterns:

```typescript
import { CoreSaaS } from './src/index';

const app = CoreSaaS({
  db: { provider: 'postgres' },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d' },
    enabled: true,
    sinks: ['db', 'stdout'],
    batchSize: 100,
    flushInterval: 5000,
    redactKeys: ['password', 'token']
  }
});

// Access services through the application
const userService = app.userService;
const roleService = app.roleService;
const contextService = app.contextService;
const permissionService = app.permissionService;

// Or access the service factory directly
const services = app.services;
const userService = services.getUserService();

// Graceful shutdown
await app.shutdown();
```

### Service Access Methods

The application provides convenient getters for all services:

```typescript
// Direct service access
const userService = app.userService;
const roleService = app.roleService;
const contextService = app.contextService;
const permissionService = app.permissionService;

// Service factory access
const services = app.services;
const allServices = services.getAllServices();
```

## CLI Usage

The CLI has been completely refactored to use the new service patterns. Here are the available commands:

### User Management

```bash
# Create a new user
lattice users:create --email user@example.com --password secret123

# List users with pagination
lattice users:list --limit 20 --offset 0

# Get user by email or ID
lattice users:get --email user@example.com
lattice users:get --userId user_123

# Delete a user
lattice users:delete --email user@example.com
lattice users:delete --userId user_123
```

### Role Management

```bash
# Create a role
lattice roles:create --name admin --contextType organization --key org_admin

# List roles with optional filtering
lattice roles:list --contextType organization

# Assign role to user
lattice roles:assign --role admin --email user@example.com --contextId org_123
lattice roles:assign --role admin --email user@example.com --contextType organization

# Remove role from user
lattice roles:remove --role admin --email user@example.com --contextId org_123

# Add permission to role
lattice roles:add-perm --role admin --permission users:read --contextId org_123

# Remove permission from role
lattice roles:remove-perm --role admin --permission users:read --contextId org_123

# List user roles
lattice roles:user-roles --email user@example.com --contextId org_123
```

### Permission Management

```bash
# Grant permission to user
lattice permissions:grant --permission users:read --email user@example.com --contextId org_123
lattice permissions:grant --permission users:read --email user@example.com --contextType organization

# Revoke permission from user
lattice permissions:revoke --permission users:read --email user@example.com --contextId org_123

# List user permissions
lattice permissions:user --email user@example.com --contextId org_123
lattice permissions:user --email user@example.com --contextType organization

# Get effective permissions (direct + role-based)
lattice permissions:effective --email user@example.com --contextId org_123
```

### Context Management

```bash
# Create a context
lattice contexts:create --id org_123 --type organization --name "Acme Corp"

# List contexts with filtering and pagination
lattice contexts:list --type organization --limit 10 --offset 0
```

### System Commands

```bash
# List all permissions
lattice list-permissions

# Check access
lattice check-access --userId user_123 --contextId org_123 --permission users:read

# Get help
lattice help
```



### Configuration

```typescript
  enabled: true,
  sampleRate: 1.0, // Log 100% of events
  redactKeys: ['password', 'token', 'secret'],
  sinks: ['db', 'stdout'], // Log to database and console
  maxMetadataSize: 1024 * 1024, // 1MB
  batchSize: 100, // Batch logs for performance
  flushInterval: 5000 // Flush every 5 seconds
};
```

### Core Methods



```typescript
  actorId: 'user_123',
  targetUserId: 'user_456',
  contextId: 'org_789',
  action: 'user.deleted',
  success: true,
  requestId: 'req_123',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  resourceType: 'user',
  resourceId: 'user_456',
  plugin: 'core',
  error: null,
  metadata: { reason: 'account_closed' }
});
```

#### `logPermissionCheck(userId, contextId, requiredPermission, success, metadata?)`

Logs permission check events:

```typescript
  'user_123',
  'org_456',
  'users:delete',
  true,
  { targetUserId: 'user_789' }
);
```

#### `logContextResolved(userId, contextId, source, metadata?)`

Logs context resolution events:

```typescript
  'user_123',
  'org_456',
  'route',
  { routeParam: 'org_456' }
);
```

#### `logTokenIssued(userId, tokenType, metadata?)`

Logs token issuance:

```typescript
  'user_123',
  'access',
  { expiresIn: '1h' }
);
```

#### `logTokenRevoked(userId, tokenType, metadata?)`

Logs token revocation:

```typescript
  'user_123',
  'access',
  { reason: 'logout' }
);
```

#### `logUserAction(actorId, targetUserId, action, success, metadata?)`

Logs user-related actions:

```typescript
  'admin_123',
  'user_456',
  'user.updated',
  true,
  { fields: ['email', 'name'] }
);
```

#### `logRoleAction(actorId, action, success, metadata?)`

Logs role-related actions:

```typescript
  'admin_123',
  'role.created',
  true,
  { roleName: 'editor', contextType: 'organization' }
);
```



```typescript
  actorId: 'user_123',
  action: 'user.deleted',
  success: true,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  limit: 50,
  offset: 0
});

console.log(`Found ${result.total} logs, showing ${result.logs.length}`);
```

#### `shutdown(): Promise<void>`


```typescript
```

## Context Service

The `ContextService` manages contexts (organizations, teams, etc.) and their relationships.

### Core Methods

#### `resolveContext(input): ContextObject | null`

Resolves context from request sources:

```typescript
// From route parameter
const context = contextService.resolveContext({
  routeParam: 'org_123'
});

// From header
const context = contextService.resolveContext({
  header: 'X-Context-ID: org_123'
});

// From query parameter
const context = contextService.resolveContext({
  query: '?context=org_123'
});

// Priority: routeParam > header > query
const context = contextService.resolveContext({
  routeParam: 'org_123',
  header: 'org_456', // Ignored due to routeParam
  query: 'org_789'   // Ignored due to routeParam
});
```

#### `createContext(params): Promise<Context>`

Creates a new context:

```typescript
const context = await contextService.createContext({
  id: 'org_123',
  type: 'organization',
  name: 'Acme Corp',
  context: { actorId: 'system' }
});
```

#### `getContext(id, context?): Promise<Context | null>`

Retrieves a context by ID:

```typescript
const context = await contextService.getContext('org_123', {
  actorId: 'user_456'
});

if (!context) {
  throw new Error('Context not found');
}
```

#### `updateContext(id, updates, context?): Promise<Context>`

Updates context properties:

```typescript
const updatedContext = await contextService.updateContext(
  'org_123',
  { name: 'Acme Corporation' },
  { actorId: 'admin_456' }
);
```

#### `deleteContext(id, context?): Promise<void>`

Deletes a context and all associated data:

```typescript
await contextService.deleteContext('org_123', {
  actorId: 'admin_456'
});
```

#### `listContexts(params?): Promise<{ contexts: Context[], total: number }>`

Lists contexts with filtering and pagination:

```typescript
// List all contexts
const result = await contextService.listContexts();

// Filter by type
const orgs = await contextService.listContexts({
  type: 'organization'
});

// With pagination
const result = await contextService.listContexts({
  type: 'organization',
  limit: 20,
  offset: 40
});
```

#### `addUserToContext(params): Promise<void>`

Adds a user to a context:

```typescript
await contextService.addUserToContext({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

#### `removeUserFromContext(params): Promise<void>`

Removes a user from a context:

```typescript
await contextService.removeUserFromContext({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

#### `getContextUsers(params): Promise<User[]>`

Gets all users in a context:

```typescript
const users = await contextService.getContextUsers({
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

## Role Service

The `RoleService` manages roles and their assignments to users.

### Core Methods

#### `createRole(params): Promise<Role>`

Creates a new role:

```typescript
const role = await roleService.createRole({
  name: 'admin',
  contextType: 'organization',
  key: 'org_admin', // Optional, auto-generated if not provided
  context: { actorId: 'system' }
});
```

#### `getRoleByName(name, context?): Promise<Role | null>`

Retrieves a role by name:

```typescript
const role = await roleService.getRoleByName('admin', {
  actorId: 'user_123'
});
```

#### `getRoleByKey(key, context?): Promise<Role | null>`

Retrieves a role by key:

```typescript
const role = await roleService.getRoleByKey('org_admin', {
  actorId: 'user_123'
});
```

#### `deleteRole(nameOrKey, context?): Promise<void>`

Deletes a role and removes all assignments:

```typescript
await roleService.deleteRole('admin', {
  actorId: 'admin_456'
});

// Or by key
await roleService.deleteRole('org_admin', {
  actorId: 'admin_456'
});
```

#### `listRoles(params?): Promise<Role[]>`

Lists roles with optional filtering:

```typescript
// List all roles
const roles = await roleService.listRoles();

// Filter by context type
const orgRoles = await roleService.listRoles({
  contextType: 'organization'
});
```

#### `assignRoleToUser(params): Promise<UserRole>`

Assigns a role to a user:

```typescript
// Global role assignment
await roleService.assignRoleToUser({
  roleName: 'admin',
  userId: 'user_123',
  context: { actorId: 'admin_456' }
});

// Context-specific role assignment
await roleService.assignRoleToUser({
  roleName: 'member',
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Type-wide role assignment
await roleService.assignRoleToUser({
  roleName: 'viewer',
  userId: 'user_123',
  contextType: 'organization',
  context: { actorId: 'admin_789' }
});

// Using role key instead of name
await roleService.assignRoleToUser({
  roleKey: 'org_admin',
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

#### `removeRoleFromUser(params): Promise<void>`

Removes a role assignment from a user:

```typescript
await roleService.removeRoleFromUser({
  roleName: 'admin',
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

#### `addPermissionToRole(params): Promise<RolePermission>`

Adds a permission to a role:

```typescript
// Global permission
await roleService.addPermissionToRole({
  roleName: 'admin',
  permissionKey: 'users:delete',
  context: { actorId: 'admin_456' }
});

// Context-specific permission
await roleService.addPermissionToRole({
  roleName: 'member',
  permissionKey: 'users:read',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Type-wide permission
await roleService.addPermissionToRole({
  roleName: 'viewer',
  permissionKey: 'users:read',
  contextType: 'organization',
  context: { actorId: 'admin_789' }
});
```

#### `removePermissionFromRole(params): Promise<void>`

Removes a permission from a role:

```typescript
await roleService.removePermissionFromRole({
  roleName: 'admin',
  permissionKey: 'users:delete',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

#### `listUserRoles(params): Promise<Array<{ name: string, contextId: string | null }>>`

Lists all roles assigned to a user:

```typescript
// All roles for user
const roles = await roleService.listUserRoles({
  userId: 'user_123',
  context: { actorId: 'admin_456' }
});

// Roles in specific context
const contextRoles = await roleService.listUserRoles({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

#### `bulkAssignRolesToUser(params): Promise<UserRole[]>`

Assigns multiple roles to a user in a single operation:

```typescript
const assignments = await roleService.bulkAssignRolesToUser({
  userId: 'user_123',
  roles: [
    { roleName: 'admin', contextId: 'org_456' },
    { roleName: 'member', contextId: 'team_789' }
  ],
  context: { actorId: 'admin_456' }
});
```

## User Service

The `UserService` manages user accounts, authentication, and profile information.

### Core Methods

#### `createUser(params): Promise<User>`

Creates a new user account:

```typescript
const user = await userService.createUser({
  email: 'user@example.com',
  password: 'securepassword123',
  context: { actorId: 'system' }
});
```

#### `getUserById(id, context?): Promise<User | null>`

Retrieves a user by their unique ID:

```typescript
const user = await userService.getUserById('user_123', {
  actorId: 'admin_456'
});

if (!user) {
  throw new Error('User not found');
}
```

#### `getUserByEmail(email, context?): Promise<User | null>`

Retrieves a user by their email address:

```typescript
const user = await userService.getUserByEmail('user@example.com', {
  actorId: 'admin_456'
});
```

#### `updateUser(id, updates, context?): Promise<User>`

Updates a user's profile information:

```typescript
// Update email
const updatedUser = await userService.updateUser(
  'user_123',
  { email: 'newemail@example.com' },
  { actorId: 'admin_456' }
);

// Update password
await userService.updateUser(
  'user_123',
  { password: 'newpassword123' },
  { actorId: 'admin_456' }
);
```

#### `deleteUser(id, context?): Promise<void>`

Permanently deletes a user and all associated data:

```typescript
await userService.deleteUser('user_123', {
  actorId: 'admin_456'
});
```

#### `listUsers(params?): Promise<{ users: User[], total: number }>`

Lists users with pagination:

```typescript
// List all users
const result = await userService.listUsers();

// With pagination
const result = await userService.listUsers({
  limit: 20,
  offset: 40,
  context: { actorId: 'admin_456' }
});
```

#### `changePassword(userId, oldPassword, newPassword, context?): Promise<void>`

Changes a user's password with verification:

```typescript
await userService.changePassword(
  'user_123',
  'oldpassword',
  'newpassword123',
  { actorId: 'user_123' }
);
```

#### `resetPassword(email, context?): Promise<void>`

Initiates a password reset for a user:

```typescript
await userService.resetPassword('user@example.com', {
  actorId: 'system'
});
```

## User Permission Service

The `UserPermissionService` manages direct permission grants to users.

### Core Methods

#### `grantToUser(params): Promise<UserPermission>`

Grants a permission directly to a user:

```typescript
// Global permission
await permissionService.grantToUser({
  userId: 'user_123',
  permissionKey: 'users:delete',
  context: { actorId: 'admin_456' }
});

// Context-specific permission
await permissionService.grantToUser({
  userId: 'user_123',
  permissionKey: 'users:read',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Type-wide permission
await permissionService.grantToUser({
  userId: 'user_123',
  permissionKey: 'users:read',
  contextType: 'organization',
  context: { actorId: 'admin_789' }
});
```

#### `revokeFromUser(params): Promise<void>`

Revokes a permission from a user:

```typescript
await permissionService.revokeFromUser({
  userId: 'user_123',
  permissionKey: 'users:delete',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

#### `getUserPermissions(params): Promise<Permission[]>`

Gets all direct permissions for a user:

```typescript
// All permissions
const permissions = await permissionService.getUserPermissions({
  userId: 'user_123',
  context: { actorId: 'admin_456' }
});

// Permissions in specific context
const contextPermissions = await permissionService.getUserPermissions({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Type-wide permissions
const typePermissions = await permissionService.getUserPermissions({
  userId: 'user_123',
  contextType: 'organization',
  context: { actorId: 'admin_789' }
});
```

#### `getRolePermissions(params): Promise<Permission[]>`

Gets all permissions assigned to a role:

```typescript
const permissions = await permissionService.getRolePermissions({
  roleId: 'role_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

#### `checkUserPermission(params): Promise<boolean>`

Checks if a user has a specific permission:

```typescript
const hasPermission = await permissionService.checkUserPermission({
  userId: 'user_123',
  permissionKey: 'users:delete',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

if (hasPermission) {
  // User can delete users in this context
}
```

#### `getUserEffectivePermissions(params): Promise<Permission[]>`

Gets all effective permissions for a user (direct + role-based):

```typescript
const effectivePermissions = await permissionService.getUserEffectivePermissions({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});
```

#### `bulkGrantToUser(params): Promise<UserPermission[]>`

Grants multiple permissions to a user in a single operation:

```typescript
const grants = await permissionService.bulkGrantToUser({
  userId: 'user_123',
  permissions: [
    { permissionKey: 'users:read', contextId: 'org_456' },
    { permissionKey: 'users:write', contextId: 'org_456' },
    { permissionKey: 'reports:view', contextId: 'org_456' }
  ],
  context: { actorId: 'admin_789' }
});
```

## Error Handling

All services use the `ServiceError` class for consistent error handling:

### Error Types

```typescript
import { ServiceError } from './src/core/services';

// Not Found Error
throw ServiceError.notFound('User', 'user_123');

// Validation Error
throw ServiceError.validationError('Email is required');

// Conflict Error
throw ServiceError.conflict('User with email already exists');

// Unauthorized Error
throw ServiceError.unauthorized('Invalid credentials');

// Forbidden Error
throw ServiceError.forbidden('Insufficient permissions');

// Internal Error
throw ServiceError.internal('Database connection failed');
```

### Error Handling Example

```typescript
try {
  const user = await userService.getUserById('user_123');
  if (!user) {
    throw ServiceError.notFound('User', 'user_123');
  }
} catch (error) {
  if (error instanceof ServiceError) {
    switch (error.code) {
      case 'NOT_FOUND':
        console.log('User not found:', error.message);
        break;
      case 'VALIDATION_ERROR':
        console.log('Validation failed:', error.message);
        break;
      default:
        console.log('Service error:', error.message);
    }
  } else {
    console.log('Unexpected error:', error);
  }
}
```

## Best Practices

### 1. Always Use Service Context

```typescript
// Good
await roleService.createRole({
  name: 'admin',
  contextType: 'organization',
  context: { actorId: 'admin_123', requestId: 'req_456' }
});

// Bad
await roleService.createRole({
  name: 'admin',
  contextType: 'organization'
});
```

### 2. Handle Errors Gracefully

```typescript
async function assignUserRole(userId: string, roleName: string, contextId: string) {
  try {
    await roleService.assignRoleToUser({
      roleName,
      userId,
      contextId,
      context: { actorId: 'admin_123' }
    });
    return { success: true };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    throw error; // Re-throw unexpected errors
  }
}
```

### 3. Use Transactions for Multi-Step Operations

```typescript
// The services handle transactions internally, but you can also use them explicitly
await roleService.withTransaction(async (tx) => {
  await tx.role.create({ data: { name: 'admin', contextType: 'org' } });
  await tx.userRole.create({ data: { userId: 'user_123', roleId: 'role_456' } });
});
```

### 4. Validate Inputs

```typescript
// Services validate inputs automatically, but you can add additional validation
if (!userId || !permissionKey) {
  throw ServiceError.validationError('User ID and permission key are required');
}

await permissionService.grantToUser({
  userId,
  permissionKey,
  contextId: 'org_123',
  context: { actorId: 'admin_456' }
});
```

### 5. Use Bulk Operations for Performance

```typescript
// Instead of multiple individual operations
for (const permission of permissions) {
  await permissionService.grantToUser({ userId, permissionKey: permission });
}

// Use bulk operations
await permissionService.bulkGrantToUser({
  userId,
  permissions: permissions.map(p => ({ permissionKey: p })),
  context: { actorId: 'admin_123' }
});
```

## Common Patterns

### 1. Permission Checking Pattern

```typescript
async function checkAndExecute(userId: string, permissionKey: string, contextId: string, action: () => Promise<void>) {
  const hasPermission = await permissionService.checkUserPermission({
    userId,
    permissionKey,
    contextId,
    context: { actorId: userId }
  });

  if (!hasPermission) {
    throw ServiceError.forbidden(`User does not have permission: ${permissionKey}`);
  }

  await action();
}
```

### 2. Context Resolution Pattern

```typescript
function resolveContextFromRequest(req: any) {
  return contextService.resolveContext({
    routeParam: req.params.contextId,
    header: req.headers['x-context-id'],
    query: req.query.context
  });
}
```


```typescript
  action: () => Promise<T>,
    actorId: string;
    action: string;
    resourceType: string;
    resourceId: string;
  }
): Promise<T> {
  try {
    const result = await action();
      success: true
    });
    return result;
  } catch (error) {
      success: false,
      error: error.message
    });
    throw error;
  }
}
```

### 4. Service Factory Pattern

```typescript
// Initialize once at application startup
const factory = new ServiceFactory({
  db,
});

// Use throughout the application
export function getUserService() {
  return factory.getUserService();
}

export function getRoleService() {
  return factory.getRoleService();
}
```

### 5. Graceful Shutdown Pattern

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down services...');
  await factory.shutdown();
  console.log('Services shut down gracefully');
  process.exit(0);
});
```

### 6. User Management Pattern

```typescript
async function createUserWithRoles(email: string, password: string, roles: string[]) {
  // Create user
  const user = await userService.createUser({
    email,
    password,
    context: { actorId: 'system' }
  });

  // Assign roles
  await roleService.bulkAssignRolesToUser({
    userId: user.id,
    roles: roles.map(roleName => ({ roleName })),
    context: { actorId: 'system' }
  });

  return user;
}
```

### 7. Application Integration Pattern

```typescript
// Initialize application with services
const app = CoreSaaS({
  db: { provider: 'postgres' },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d' },
    enabled: true,
    sinks: ['db', 'stdout'],
    batchSize: 100,
    flushInterval: 5000
  }
});

// Use services throughout the application
app.route({
  method: 'POST',
  path: '/users',
  handler: async ({ user, body }) => {
    const newUser = await app.userService.createUser({
      email: body.email,
      password: body.password,
      context: { actorId: user?.id || 'system' }
    });
    return newUser;
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.shutdown();
  process.exit(0);
});
```

