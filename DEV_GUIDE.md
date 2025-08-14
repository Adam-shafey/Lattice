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

## Using the Roles System

- **Creating Roles:**
  - Use the `RoleService` to create roles with a name and context type.
  - Example:
    ```typescript
    const role = await roleService.createRole('admin', { contextType: 'global' });
    ```

- **Assigning Roles:**
  - Assign roles to users with specific context using `assignRoleToUser`.
  - Example:
    ```typescript
    await roleService.assignRoleToUser({ roleName: 'admin', userId: 'user_123', contextId: 'ctx_1' });
    ```

- **Managing Role Permissions:**
  - Add or remove permissions from roles using `addPermissionToRole` and `removePermissionFromRole`.
  - Example:
    ```typescript
    await roleService.addPermissionToRole({ roleName: 'admin', permissionKey: 'example:read' });
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
      "contextType": "global"
    }
    ```

## Using the Services

- **Audit Service:**
  - Log actions such as role creation, permission grants, and user assignments using the `AuditService`.
  - Example:
    ```typescript
    await auditService.log({
      actorId: 'actor_123',
      action: 'role.created',
      success: true,
      metadata: { roleName: 'admin' }
    });
    ```
