# Developer Guide for Lattice Application

## Setting Up the Development Environment

1. **Install Dependencies:**
   - Ensure you have Node.js 18+ installed.
   - Run `npm install` to install all necessary packages.

2. **Database Setup:**
   - Set the `DATABASE_URL` environment variable to point to your SQLite development database:
     - PowerShell: `$env:DATABASE_URL = 'file:./dev.db'`
     - Bash: `export DATABASE_URL="file:./dev.db"`
   - Initialize the database with Prisma:
     - Run `npx prisma generate` to generate the Prisma client.
     - Run `npx prisma db push` to apply the schema to the database.

3. **Running the Development Server:**
   - Start the server with `npm run dev`.
   - Test the server by accessing `GET http://localhost:3000/ping` which should return `{ pong: true }`.

4. **Using the CLI:**
   - Build the project with `npm run build`.
   - Use the CLI for various operations, such as listing permissions or checking access:
     - `node dist/core/cli/index.js list-permissions`
     - `node dist/core/cli/index.js check-access --userId user_123 --contextId ctx_1 --permission example:read`

## Testing the Application

1. **Running Tests:**
   - The project uses `vitest` for testing.
   - To run the tests, execute `npm test`.

2. **End-to-End Testing:**
   - The `e2e.auth.test.ts` file provides an example of end-to-end testing for authentication.
   - It tests the login and token refresh functionality using the Fastify adapter.

3. **Writing Tests:**
   - Tests are located in the `src/tests` directory.
   - Use `describe`, `it`, and `expect` from `vitest` to structure your tests.
   - Ensure to clean up any test data created during the tests to maintain a clean state.

## Using the Service Layer

Lattice Core provides a production-ready service layer with consistent patterns for error handling, validation, audit logging, and transaction management.

### Service Factory

The `ServiceFactory` manages all service instances and provides centralized access:

```typescript
import { ServiceFactory } from './src/core/services';
import { db } from './src/core/db/db-client';

// Initialize the service factory
const factory = new ServiceFactory({
  db,
  audit: {
    enabled: true,
    sinks: ['db', 'stdout'],
    batchSize: 100,
    flushInterval: 5000,
    redactKeys: ['password', 'token']
  }
});

// Access all services
const auditService = factory.auditService;
const contextService = factory.getContextService();
const roleService = factory.getRoleService();
const permissionService = factory.getPermissionService();
const userService = factory.getUserService();
```

### Application Integration

The main application provides convenient access to all services:

```typescript
import { CoreSaaS } from './src/index';

const app = CoreSaaS({
  db: { provider: 'postgres' },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d' },
  audit: {
    enabled: true,
    sinks: ['db', 'stdout'],
    batchSize: 100,
    flushInterval: 5000
  }
});

// Access services through the application
const userService = app.userService;
const roleService = app.roleService;
const contextService = app.contextService;
const permissionService = app.permissionService;
const auditService = app.auditService;

// Or access the service factory directly
const services = app.services;
```

### Service Context

Most service methods accept an optional `ServiceContext` for audit logging:

```typescript
const serviceContext = {
  actorId: 'user_123',
  requestId: 'req_456',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
};
```

## Using the User Service

The `UserService` manages user accounts, authentication, and profile information:

```typescript
// Create a new user
const user = await userService.createUser({
  email: 'user@example.com',
  password: 'securepassword123',
  context: { actorId: 'system' }
});

// Get user by email
const user = await userService.getUserByEmail('user@example.com');

// Update user profile
await userService.updateUser('user_123', {
  email: 'newemail@example.com'
}, { actorId: 'admin_456' });

// Change password with verification
await userService.changePassword('user_123', 'oldpass', 'newpass123', {
  actorId: 'user_123'
});

// List users with pagination
const result = await userService.listUsers({
  limit: 20,
  offset: 40
});

// Delete user (with cascade cleanup)
await userService.deleteUser('user_123', {
  actorId: 'admin_456'
});
```

## Using the Role Service

The `RoleService` manages roles and their assignments to users:

```typescript
// Create a role
const role = await roleService.createRole({
  name: 'admin',
  contextType: 'organization',
  context: { actorId: 'system' }
});

// Assign role to user
await roleService.assignRoleToUser({
  roleName: 'admin',
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Add permission to role
await roleService.addPermissionToRole({
  roleName: 'admin',
  permissionKey: 'users:delete',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// List user roles
const roles = await roleService.listUserRoles({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Bulk assign roles
await roleService.bulkAssignRolesToUser({
  userId: 'user_123',
  roles: [
    { roleName: 'admin', contextId: 'org_456' },
    { roleName: 'member', contextId: 'team_789' }
  ],
  context: { actorId: 'admin_456' }
});
```

## Using the Permission Service

The `UserPermissionService` manages direct permission grants to users:

```typescript
// Grant permission to user
await permissionService.grantToUser({
  userId: 'user_123',
  permissionKey: 'users:read',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Check user permission
const hasPermission = await permissionService.checkUserPermission({
  userId: 'user_123',
  permissionKey: 'users:read',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Get effective permissions (direct + role-based)
const permissions = await permissionService.getUserEffectivePermissions({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// Bulk grant permissions
await permissionService.bulkGrantToUser({
  userId: 'user_123',
  permissions: [
    { permissionKey: 'users:read', contextId: 'org_456' },
    { permissionKey: 'users:write', contextId: 'org_456' }
  ],
  context: { actorId: 'admin_789' }
});
```

## Using the Context Service

The `ContextService` manages contexts (organizations, teams, etc.) and their relationships:

```typescript
// Create a context
const context = await contextService.createContext({
  id: 'org_123',
  type: 'organization',
  name: 'Acme Corp',
  context: { actorId: 'system' }
});

// Resolve context from request
const resolved = contextService.resolveContext({
  routeParam: 'org_123',
  header: 'x-context-id',
  query: 'context'
});

// Add user to context
await contextService.addUserToContext({
  userId: 'user_123',
  contextId: 'org_456',
  context: { actorId: 'admin_789' }
});

// List contexts with filtering
const contexts = await contextService.listContexts({
  type: 'organization',
  limit: 20,
  offset: 0
});
```

## Using the Audit Service

The `AuditService` provides comprehensive logging for all system events:

```typescript
// Log custom events
await auditService.log({
  actorId: 'user_123',
  action: 'user.deleted',
  success: true,
  targetUserId: 'user_456',
  contextId: 'org_789',
  metadata: { reason: 'account_closed' }
});

// Convenience methods
await auditService.logPermissionCheck('user_123', 'org_456', 'users:delete', true);
await auditService.logTokenIssued('user_123', 'access', { expiresIn: '1h' });
await auditService.logUserAction('admin_123', 'user_456', 'user.updated', true);

// Query audit logs
const result = await auditService.getAuditLogs({
  actorId: 'user_123',
  action: 'user.deleted',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  limit: 50,
  offset: 0
});
```

## Using the Permissions System

- **Registering Permissions:**
  - Use the `PermissionRegistry` class to register permissions with a unique key and label.
  - Example:
    ```typescript
    app.PermissionRegistry.register({
      key: 'billing:charge',
      label: 'Charge a customer',
      plugin: 'billing'
    });
    ```

- **Checking Permissions:**
  - Use the `isAllowed` method to check if a required permission is granted.
  - Example:
    ```typescript
    const isAllowed = app.PermissionRegistry.isAllowed('required:permission', grantedPermissionsSet);
    ```

- **Database Synchronization:**
  - Initialize permissions from the database using `initFromDatabase`.
  - Sync permissions to the database using `syncToDatabase`.

## Using the Enhanced CLI

The CLI has been completely refactored to use the new service patterns and provides comprehensive management capabilities:

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

## Using the API

- **Permission Routes:**
  - Grant or revoke user permissions via API endpoints `/permissions/user/grant` and `/permissions/user/revoke`.
  - Example:
    ```typescript
    // Grant permission
    POST /permissions/user/grant
    {
      "userId": "user_123",
      "permissionKey": "example:read"
    }
    ```

- **Role Routes:**
  - Manage roles via API endpoints such as `/roles`, `/roles/assign`, and `/roles/:name/permissions/add`.
  - Example:
    ```typescript
    // Create a role
    POST /roles
    {
      "name": "admin",
      "contextType": "organization"
    }
    ```

## Error Handling

All services use the `ServiceError` class for consistent error handling:

```typescript
import { ServiceError } from './src/core/services';

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

### 3. Use Bulk Operations for Performance

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

### 4. Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down services...');
  await app.shutdown();
  console.log('Services shut down gracefully');
  process.exit(0);
});
```

## Migration from Old Patterns

### 1. Update Service Instantiation

```typescript
// Old
const roleService = new RoleService(app);

// New
const roleService = app.roleService;
// or
const roleService = app.services.getRoleService();
```

### 2. Update Method Calls

```typescript
// Old
await roleService.createRole('admin', { contextType: 'org' });

// New
await roleService.createRole({
  name: 'admin',
  contextType: 'org',
  context: { actorId: 'user_123' }
});
```

### 3. Update Error Handling

```typescript
// Old
throw new Error('User not found');

// New
throw ServiceError.notFound('User', userId);
```

### 4. Update CLI Commands

```bash
# Old CLI commands still work, but new ones are available
# New commands provide better output and more features
lattice users:list --limit 10
lattice permissions:effective --email user@example.com
lattice contexts:create --id org_123 --type organization --name "Acme Corp"
```
