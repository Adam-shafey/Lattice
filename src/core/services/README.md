# Lattice Core Services

This directory contains the refactored, production-ready services for Lattice Core. All services follow consistent patterns for error handling, validation, audit logging, and transaction management.

## Architecture Overview

### Service Hierarchy

```
BaseService (abstract)
├── AuditService
├── ContextService
├── RoleService
├── UserService
└── UserPermissionService

ServiceFactory (manages all services)
```

### Key Design Principles

1. **Consistent Error Handling**: All services use `ServiceError` with standardized error codes and messages
2. **Input Validation**: Comprehensive validation with descriptive error messages
3. **Audit Logging**: Automatic audit logging for all operations with configurable sinks
4. **Transaction Support**: Proper transaction handling for multi-step operations
5. **Interface Contracts**: All services implement interfaces for better testing and mocking
6. **Dependency Injection**: Services receive dependencies through constructor injection
7. **Type Safety**: Full TypeScript support with proper type definitions

## Service Interfaces

All services implement interfaces defined in `interfaces.ts`:

- `IUserService` - User management operations ✅ **COMPLETED**
- `IRoleService` - Role management and assignment ✅ **COMPLETED**
- `IPermissionService` - Permission management and checking ✅ **COMPLETED**
- `IContextService` - Context resolution and management ✅ **COMPLETED**
- `IServiceFactory` - Factory for creating and managing services ✅ **COMPLETED**

## Base Service Infrastructure

### ServiceError

Standardized error handling with predefined error types:

```typescript
// Common error types
ServiceError.notFound('User', 'user_123')
ServiceError.validationError('Email is required')
ServiceError.conflict('User already exists')
ServiceError.unauthorized('Invalid credentials')
ServiceError.forbidden('Insufficient permissions')
ServiceError.internal('Database connection failed')
```

### BaseService

Abstract base class providing common functionality:

- Database client access
- Audit service integration
- Transaction support
- Input validation helpers
- Standardized audit logging

## Service Implementations

### AuditService ✅ **COMPLETED**

Enhanced audit logging with batch processing and multiple sinks:

```typescript
const auditService = new AuditService({
  enabled: true,
  sampleRate: 1.0,
  sinks: ['db', 'stdout'],
  batchSize: 100,
  flushInterval: 5000,
  maxMetadataSize: 1024 * 1024,
  redactKeys: ['password', 'token']
});

// Log operations
await auditService.log({
  actorId: 'user_123',
  action: 'user.created',
  success: true,
  metadata: { email: 'user@example.com' }
});

// Convenience methods
await auditService.logPermissionCheck(userId, contextId, permission, success);
await auditService.logTokenIssued(userId, 'access');
await auditService.logUserAction(actorId, targetUserId, 'user.updated', true);
```

### ContextService ✅ **COMPLETED**

Context management with full CRUD operations:

```typescript
const contextService = new ContextService(db, auditConfig);

// Create context
const context = await contextService.createContext({
  id: 'org_123',
  type: 'organization',
  name: 'Acme Corp'
});

// Resolve context from request
const resolved = contextService.resolveContext({
  routeParam: 'org_123',
  header: 'x-context-id',
  query: 'context'
});

// Manage context users
await contextService.addUserToContext({
  userId: 'user_123',
  contextId: 'org_123'
});
```

### RoleService ✅ **COMPLETED**

Role management with context-aware assignments:

```typescript
const roleService = new RoleService(db, auditConfig);

// Create role
const role = await roleService.createRole({
  name: 'admin',
  contextType: 'organization'
});

// Assign role to user
await roleService.assignRoleToUser({
  roleName: 'admin',
  userId: 'user_123',
  contextId: 'org_123'
});

// Add permissions to role
await roleService.addPermissionToRole({
  roleName: 'admin',
  permissionKey: 'users:read',
  contextId: 'org_123'
});

// Bulk operations
await roleService.bulkAssignRolesToUser({
  userId: 'user_123',
  roles: [
    { roleName: 'admin', contextId: 'org_123' },
    { roleName: 'member', contextId: 'team_456' }
  ]
});
```

### UserService ✅ **COMPLETED**

User management with authentication and profile operations:

```typescript
const userService = new UserService(db, auditConfig);

// Create user
const user = await userService.createUser({
  email: 'user@example.com',
  password: 'securepassword123'
});

// Get user by ID or email
const user = await userService.getUserById('user_123');
const user = await userService.getUserByEmail('user@example.com');

// Update user profile
await userService.updateUser('user_123', {
  email: 'newemail@example.com'
});

// Change password with verification
await userService.changePassword('user_123', 'oldpass', 'newpass123');

// Reset password
await userService.resetPassword('user@example.com');

// List users with pagination
const result = await userService.listUsers({
  limit: 20,
  offset: 40
});

// Delete user (with cascade cleanup)
await userService.deleteUser('user_123');
```

### UserPermissionService ✅ **COMPLETED**

Permission management with effective permission calculation:

```typescript
const permissionService = new UserPermissionService(db, auditConfig);

// Grant permission to user
await permissionService.grantToUser({
  userId: 'user_123',
  permissionKey: 'users:read',
  contextId: 'org_123'
});

// Check user permission
const hasPermission = await permissionService.checkUserPermission({
  userId: 'user_123',
  permissionKey: 'users:read',
  contextId: 'org_123'
});

// Get effective permissions (direct + role-based)
const permissions = await permissionService.getUserEffectivePermissions({
  userId: 'user_123',
  contextId: 'org_123'
});

// Bulk operations
await permissionService.bulkGrantToUser({
  userId: 'user_123',
  permissions: [
    { key: 'users:read', contextId: 'org_123' },
    { key: 'users:write', contextId: 'org_123' }
  ]
});
```

## Service Factory

Centralized service management with dependency injection:

```typescript
// Initialize service factory
const serviceFactory = new ServiceFactory({
  db: prismaClient,
  audit: {
    enabled: true,
    sinks: ['db', 'stdout']
  }
});

// Get services
const contextService = serviceFactory.getContextService();
const roleService = serviceFactory.getRoleService();
const permissionService = serviceFactory.getPermissionService();
const userService = serviceFactory.getUserService();
const auditService = serviceFactory.auditService;

// Get all services at once
const { audit, context, role, permission, user } = serviceFactory.getAllServices();

// Graceful shutdown
await serviceFactory.shutdown();
```

### Global Service Factory

For application-wide access:

```typescript
// Initialize once at app startup
getServiceFactory({
  db: prismaClient,
  audit: { enabled: true }
});

// Use anywhere in the application
const services = getServiceFactory();
const roleService = services.getRoleService();
```

## Application Integration

### Main Application (index.ts) ✅ **REFACTORED**

The main application has been refactored to use the new service patterns:

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
    flushInterval: 5000,
    redactKeys: ['password', 'token']
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
const userService = services.getUserService();

// Graceful shutdown
await app.shutdown();
```

### CLI Integration ✅ **REFACTORED**

The CLI has been completely refactored to use the new service patterns:

```bash
# User Management
lattice users:create --email user@example.com --password secret123
lattice users:list --limit 20 --offset 0
lattice users:get --email user@example.com
lattice users:delete --email user@example.com

# Role Management (Enhanced)
lattice roles:create --name admin --contextType organization --key org_admin
lattice roles:list --contextType organization
lattice roles:assign --role admin --email user@example.com --contextId org_123

# Permission Management (New)
lattice permissions:grant --permission users:read --email user@example.com --contextId org_123
lattice permissions:user --email user@example.com --contextId org_123
lattice permissions:effective --email user@example.com --contextId org_123

# Context Management (New)
lattice contexts:create --id org_123 --type organization --name "Acme Corp"
lattice contexts:list --type organization --limit 10
```

## Error Handling Patterns

All services follow consistent error handling:

```typescript
try {
  const user = await userService.getUserById('user_123');
  if (!user) {
    throw ServiceError.notFound('User', 'user_123');
  }
  return user;
} catch (error) {
  if (error instanceof ServiceError) {
    // Handle known service errors
    throw error;
  }
  // Handle unexpected errors
  throw ServiceError.internal('Failed to get user');
}
```

## Validation Patterns

Comprehensive input validation:

```typescript
// Required fields
this.validateRequired(value, 'fieldName');

// String validation
this.validateString(value, 'fieldName', minLength);

// Email validation
this.validateEmail(email);

// UUID validation
this.validateUUID(id, 'fieldName');
```

## Audit Logging Patterns

Automatic audit logging for all operations:

```typescript
return this.withAudit(
  async () => {
    // Operation logic here
    return result;
  },
  {
    action: 'user.created',
    success: true,
    targetUserId: userId,
    resourceType: 'user',
    resourceId: userId,
    metadata: { email, source }
  },
  serviceContext
);
```

## Transaction Patterns

Proper transaction handling:

```typescript
await this.withTransaction(async (tx) => {
  // Multiple database operations
  await tx.user.create({ data: userData });
  await tx.userRole.create({ data: roleData });
  await tx.userPermission.create({ data: permissionData });
});
```

## Testing

Services are designed for easy testing:

```typescript
// Mock service factory
const mockServiceFactory = {
  getRoleService: () => ({
    createRole: jest.fn(),
    assignRoleToUser: jest.fn()
  })
};

// Test with interfaces
const roleService: IRoleService = mockServiceFactory.getRoleService();
```

## Migration Guide

### From Old Services

1. **Replace direct service instantiation**:
   ```typescript
   // Old
   const roleService = new RoleService(app);
   
   // New
   const roleService = serviceFactory.getRoleService();
   // or
   const roleService = app.roleService;
   ```

2. **Update error handling**:
   ```typescript
   // Old
   throw new Error('User not found');
   
   // New
   throw ServiceError.notFound('User', userId);
   ```

3. **Add service context**:
   ```typescript
   // Old
   await roleService.createRole('admin');
   
   // New
   await roleService.createRole({
     name: 'admin',
     contextType: 'organization',
     context: { actorId: 'user_123' }
   });
   ```

4. **Update CLI commands**:
   ```bash
   # Old CLI commands still work, but new ones are available
   # New commands provide better output and more features
   lattice users:list --limit 10
   lattice permissions:effective --email user@example.com
   ```

## Configuration

### Audit Configuration

```typescript
const auditConfig: AuditConfig = {
  enabled: true,
  sampleRate: 1.0, // 100% of operations
  sinks: ['db', 'stdout'],
  batchSize: 100,
  flushInterval: 5000,
  maxMetadataSize: 1024 * 1024, // 1MB
  redactKeys: ['password', 'token', 'secret']
};
```

### Service Factory Configuration

```typescript
const serviceFactoryConfig: ServiceFactoryConfig = {
  db: prismaClient,
  audit: auditConfig
};
```

### Application Configuration

```typescript
const appConfig: CoreConfig = {
  db: { provider: 'postgres' },
  adapter: 'fastify',
  jwt: { accessTTL: '15m', refreshTTL: '7d' },
  audit: {
    enabled: true,
    sinks: ['db', 'stdout'],
    batchSize: 100,
    flushInterval: 5000
  }
};
```

## Performance Considerations

1. **Batch Processing**: Audit service supports batch logging for high-throughput scenarios
2. **Connection Pooling**: Services use shared database connections
3. **Lazy Loading**: Service factory creates services on-demand
4. **Transaction Optimization**: Use transactions for multi-step operations
5. **Caching**: Consider adding Redis caching for frequently accessed data

## Security Considerations

1. **Input Validation**: All inputs are validated before processing
2. **Audit Logging**: All operations are logged for security monitoring
3. **Error Sanitization**: Sensitive information is redacted from logs
4. **Permission Checking**: Services validate permissions before operations
5. **SQL Injection Protection**: Use Prisma's parameterized queries
6. **Password Security**: Passwords are hashed using bcrypt with salt rounds

## Monitoring and Observability

1. **Audit Logs**: Comprehensive audit trail for all operations
2. **Error Tracking**: Standardized error codes and messages
3. **Performance Metrics**: Transaction timing and success rates
4. **Health Checks**: Service factory provides health check methods
5. **Graceful Shutdown**: Proper cleanup on application shutdown

## Current Status

### ✅ **Completed Services**
- **AuditService**: Full audit logging with batching, multiple sinks, querying
- **ContextService**: Complete CRUD operations with context management
- **RoleService**: Role management with bulk operations and context awareness
- **UserService**: User management with authentication, password handling, and profile operations
- **UserPermissionService**: Permission management with effective permission calculation
- **ServiceFactory**: Centralized service management with dependency injection

### ✅ **Completed Integration**
- **Main Application (index.ts)**: Refactored to use new service patterns
- **CLI**: Completely refactored with new commands and service integration
- **Documentation**: Comprehensive guides and examples

### 🔄 **Next Steps**
1. **Caching Layer**: Add Redis caching for frequently accessed data
2. **Hierarchical Contexts**: Implement parent-child context relationships
3. **Plugin System Integration**: Integrate services with plugin system
4. **Monitoring and Metrics**: Add performance metrics and health checks

## Documentation

- **`SERVICE_USAGE_GUIDE.md`**: Comprehensive usage guide with examples
- **`REFACTORING_SUMMARY.md`**: Detailed summary of all refactoring changes
- **`interfaces.ts`**: TypeScript interfaces for all services
- **`base-service.ts`**: Base service infrastructure and utilities
