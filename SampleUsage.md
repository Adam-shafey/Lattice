## **1️⃣ Spinning up the core**

```ts
import { CoreSaaS } from '@yourorg/lattice-core'

const app = CoreSaaS({
  db: { provider: 'postgres', url: process.env.DATABASE_URL },
  adapter: 'fastify', // can also be 'express'
  jwt: { accessTTL: '15m', refreshTTL: '7d' },
  audit: {
    enabled: true,
    sinks: ['db', 'stdout'],
    batchSize: 100,
    flushInterval: 5000,
    redactKeys: ['password', 'token']
  }
})

await app.listen(3000)
console.log('Lattice Core running on port 3000')
```

* Dev chooses adapter (Fastify or Express).
* Core handles auth, context, and permission infra.
* **Production-ready service layer** with standardized patterns.
* No business routes exposed yet.

---

## **2️⃣ Using the service layer**

```ts
// Access all services through the application
const userService = app.userService;
const roleService = app.roleService;
const contextService = app.contextService;
const permissionService = app.permissionService;
const auditService = app.auditService;

// Or access the service factory directly
const services = app.services;
const userService = services.getUserService();

// Create a user with secure password hashing
const user = await userService.createUser({
  email: 'user@example.com',
  password: 'securepassword123',
  context: { actorId: 'system' }
});

// Create a role
const role = await roleService.createRole({
  name: 'admin',
  contextType: 'organization',
  context: { actorId: 'system' }
});

// Assign role to user
await roleService.assignRoleToUser({
  roleName: 'admin',
  userId: user.id,
  contextId: 'org_123',
  context: { actorId: 'admin_456' }
});

// Grant permission to user
await permissionService.grantToUser({
  userId: user.id,
  permissionKey: 'users:read',
  contextId: 'org_123',
  context: { actorId: 'admin_456' }
});
```

* **Standardized error handling** with `ServiceError` types.
* **Automatic audit logging** for all operations.
* **Input validation** with descriptive error messages.
* **Transaction support** for multi-step operations.

---

## **3️⃣ Registering plugins**

```ts
import TeamsPlugin from '@yourorg/lattice-plugin-teams'
import UploadsPlugin from '@yourorg/lattice-plugin-uploads'

app.registerPlugin(TeamsPlugin)
app.registerPlugin(UploadsPlugin)
```

* Plugins automatically register:

  * Permissions in **Permission Registry**
  * Optional context types
  * Routes
* Dev doesn't need to touch core code to extend functionality.

---

## **4️⃣ Defining routes in a plugin**

```ts
// plugin route example
app.route({
  method: 'POST',
  path: '/teams/:contextId/invite',
  preHandler: app.authorize('team:invite', { contextRequired: true }),
  handler: async ({ user, context, body }) => {
    // Use services for business logic
    const newMember = await app.userService.createUser({
      email: body.email,
      password: body.password,
      context: { actorId: user.id }
    });
    
    await app.contextService.addUserToContext({
      userId: newMember.id,
      contextId: context.id,
      context: { actorId: user.id }
    });
    
    return { success: true, userId: newMember.id };
  }
})
```

* `authorize()` ensures:

  * User has permission `team:invite`
  * Context is valid and matches route/query/header
* `handler` receives **guaranteed** `user` and `context`.
* **Service layer** provides consistent business logic patterns.

---

## **5️⃣ Programmatic permission check**

```ts
const hasAccess = await app.checkAccess({
  userId: 'user_123',
  contextId: 'team_456',
  permission: 'team:update'
})

if (!hasAccess) throw new Error('Forbidden')
```

* Useful for **backend-only logic** (not tied to an HTTP request).
* Works with multi-context and wildcard permissions.

---

## **6️⃣ Adding dynamic plugin permissions**

```ts
app.PermissionRegistry.register({
  key: 'billing:charge',
  label: 'Charge a customer',
  plugin: 'billing'
})
```

* Dev can hot-add permissions at runtime.
* DB sync ensures persisted permissions across restarts.

---

## **7️⃣ Using CLI tooling**

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

* CLI enhances **DX**: devs can inspect and simulate permission access without coding.
* **Comprehensive management** of users, roles, permissions, and contexts.

---

## **8️⃣ Context management example**

```ts
// resolve context hierarchy
const context = await app.contextService.resolveContext({
  routeParam: 'team_456',
  header: 'org_123',
  query: 'project_789'
})

// returns the most specific valid context
// or throws if user lacks access
```

* Core automatically handles conflicts:

  * Rejects access if resolved context is unauthorized
  * Supports parent → child permission inheritance

---

## **9️⃣ Multi-adapter example**

```ts
// Fastify
app.route({ method: 'GET', path: '/ping', handler: () => 'pong' })

// Express
app.express.get('/ping', (req, res) => res.send('pong'))
```

* Middleware (`authorize`, `context resolver`) works in both adapters.
* Devs can switch adapters without rewriting plugins.

---

## **🔟 Service patterns and best practices**

```ts
// Error handling with ServiceError
try {
  const user = await app.userService.getUserById('user_123');
  if (!user) {
    throw ServiceError.notFound('User', 'user_123');
  }
} catch (error) {
  if (error instanceof ServiceError) {
    // Handle known service errors
    console.log(`${error.code}: ${error.message}`);
  } else {
    // Handle unexpected errors
    throw error;
  }
}

// Bulk operations for performance
await app.permissionService.bulkGrantToUser({
  userId: 'user_123',
  permissions: [
    { permissionKey: 'users:read', contextId: 'org_123' },
    { permissionKey: 'users:write', contextId: 'org_123' },
    { permissionKey: 'reports:view', contextId: 'org_123' }
  ],
  context: { actorId: 'admin_456' }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.shutdown();
  process.exit(0);
});
```

* **Consistent error handling** across all services.
* **Bulk operations** for better performance.
* **Graceful shutdown** with proper cleanup.

---

### **Developer Workflow Summary**

1. **Install Core:** `npm install @yourorg/lattice-core`
2. **Spin up server** with adapter and DB config.
3. **Use service layer** for consistent business logic patterns.
4. **Register plugins** (Teams, Uploads, etc.).
5. **Write plugin routes** guarded by `authorize()`.
6. **Check permissions programmatically** when needed.
7. **Use CLI** to inspect permissions, simulate access, and manage entities.
8. **Add new plugin permissions** dynamically for hot-reload dev experience.
9. **Handle errors gracefully** with `ServiceError` types.
10. **Use bulk operations** for performance-critical scenarios.

---