"use strict";
/**
 * User Permission Service
 *
 * This service manages user permissions in the Lattice Core system. It handles
 * direct permission grants to users, permission revocation, and permission queries.
 * The service supports context-aware permissions, allowing permissions to be
 * scoped to specific contexts (e.g., organizations, teams) or applied globally.
 *
 * Key Features:
 * - Direct permission grants to users
 * - Context-aware permission management
 * - Permission revocation and cleanup
 * - Effective permission calculation (direct + role-based)
 * - Bulk permission operations
 *
 * Permission Scoping:
 * - Global: Permission applies to all contexts
 * - Type-wide: Permission applies to all contexts of a specific type
 * - Context-specific: Permission applies only to a specific context
 *
 * Usage:
 * const permissionService = new UserPermissionService(db);
 * await permissionService.grantToUser({
 *   userId: 'user_123',
 *   permissionKey: 'users:read',
 *   contextId: 'org_456'
 * });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPermissionService = void 0;
const base_service_1 = require("./base-service");
/**
 * UserPermissionService Class
 *
 * Implements the IPermissionService interface and provides all permission-related
 * operations for users. Extends BaseService to inherit common functionality like
 * validation and transaction management.
 */
class UserPermissionService extends base_service_1.BaseService {
    constructor(db, permissionRegistry) {
        super(db);
        this.permissionRegistry = permissionRegistry;
    }
    /**
     * Grants a permission directly to a user in a specific context
     *
     * This method creates a direct permission grant for a user, which takes precedence
     * over role-based permissions. The permission can be scoped to a specific context,
     * a context type, or applied globally.
     *
     * @param params.userId - The user's unique identifier
     * @param params.permissionKey - The permission key to grant (e.g., 'users:read')
     * @param params.contextId - Optional specific context ID for context-scoped permissions
     * @param params.contextType - Optional context type for type-wide permissions
     * @param params.context - Optional service context
     * @returns Promise resolving to the created UserPermission record
     *
     * @throws ServiceError.notFound if user or context doesn't exist
     * @throws ServiceError.validationError if inputs are invalid
     *
     * Example:
     * await permissionService.grantToUser({
     *   userId: 'user_123',
     *   permissionKey: 'users:write',
     *   contextId: 'org_456',
     *   context: { actorId: 'admin_789' }
     * });
     */
    async grantToUser(params) {
        const { userId, permissionKey, contextId, contextType, context: serviceContext } = params;
        // Validate required inputs
        this.validateString(userId, 'user id');
        this.validateString(permissionKey, 'permission key');
        return this.execute(async () => {
            // Verify the user exists before granting permissions
            await this.ensureUserExists(userId);
            // Verify the context exists if a specific context ID is provided
            if (contextId) {
                await this.ensureContextExists(contextId);
            }
            // Create or find the permission record
            // Uses upsert to handle cases where the permission might already exist
            const permission = await this.db.permission.upsert({
                where: { key: permissionKey },
                update: {}, // No updates needed if permission exists
                create: { key: permissionKey, label: permissionKey },
            });
            // Create the user-permission link with a unique ID
            // Format: userId-permissionId-contextId (or 'global' for global permissions)
            const id = `${userId}-${permission.id}-${contextId ?? 'global'}`;
            const userPermission = await this.db.userPermission.upsert({
                where: { id },
                update: {}, // No updates needed if link already exists
                create: {
                    id,
                    userId,
                    permissionId: permission.id,
                    contextId: contextId ?? null,
                    contextType: contextId ? null : (contextType ?? null),
                },
            });
            return userPermission;
        }, {
            action: 'permission.user.granted',
            success: true,
            targetUserId: userId,
            contextId,
            resourceType: 'permission',
            resourceId: permissionKey,
            metadata: { permissionKey, contextType },
        }, serviceContext);
    }
    /**
     * Revokes a permission from a user
     *
     * This method removes a direct permission grant from a user. It handles both
     * context-specific and type-wide permission revocations. If the permission
     * doesn't exist, the operation completes successfully (idempotent).
     *
     * @param params.userId - The user's unique identifier
     * @param params.permissionKey - The permission key to revoke
     * @param params.contextId - Optional specific context ID for context-scoped permissions
     * @param params.contextType - Optional context type for type-wide permissions
     * @param params.context - Optional service context
     * @returns Promise that resolves when permission is revoked
     *
     * @throws ServiceError.notFound if user doesn't exist
     * @throws ServiceError.validationError if inputs are invalid
     *
     * Example:
     * await permissionService.revokeFromUser({
     *   userId: 'user_123',
     *   permissionKey: 'users:write',
     *   contextId: 'org_456'
     * });
     */
    async revokeFromUser(params) {
        const { userId, permissionKey, contextId, contextType, context: serviceContext } = params;
        // Validate required inputs
        this.validateString(userId, 'user id');
        this.validateString(permissionKey, 'permission key');
        return this.execute(async () => {
            // Verify the user exists before revoking permissions
            await this.ensureUserExists(userId);
            // Find the permission record
            const permission = await this.db.permission.findUnique({ where: { key: permissionKey } });
            if (!permission) {
                // Permission doesn't exist, so there's nothing to revoke
                // This is idempotent - no error is thrown
                return;
            }
            // Try to delete the exact permission first (context-specific)
            const id = `${userId}-${permission.id}-${contextId ?? 'global'}`;
            try {
                await this.db.userPermission.delete({ where: { id } });
            }
            catch {
                // If exact match not found, try type-wide form for context-type permissions
                if (!contextId && contextType) {
                    await this.db.userPermission.deleteMany({
                        where: {
                            userId,
                            permissionId: permission.id,
                            contextId: null,
                            contextType,
                        },
                    });
                }
            }
        }, {
            action: 'permission.user.revoked',
            success: true,
            targetUserId: userId,
            contextId,
            resourceType: 'permission',
            resourceId: permissionKey,
            metadata: { permissionKey, contextType },
        }, serviceContext);
    }
    /**
     * Gets all direct permissions granted to a user in a specific context
     *
     * This method retrieves only the permissions that were directly granted to
     * the user (not inherited from roles). The permissions can be filtered by
     * context ID, context type, or global permissions.
     *
     * @param params.userId - The user's unique identifier
     * @param params.contextId - Optional specific context ID for context-scoped permissions
     * @param params.contextType - Optional context type for type-wide permissions
     * @param params.context - Optional service context
     * @returns Promise resolving to array of Permission objects
     *
     * @throws ServiceError.notFound if user doesn't exist
     * @throws ServiceError.validationError if inputs are invalid
     *
     * Example:
     * const permissions = await permissionService.getUserPermissions({
     *   userId: 'user_123',
     *   contextId: 'org_456'
     * });
     */
    async getUserPermissions(params) {
        const { userId, contextId, contextType, context: serviceContext } = params;
        // Validate required inputs
        this.validateString(userId, 'user id');
        return this.execute(async () => {
            // Verify the user exists before querying permissions
            await this.ensureUserExists(userId);
            // Build the where clause based on the provided context parameters
            const where = { userId };
            if (contextId) {
                // Context-specific permissions
                where.contextId = contextId;
            }
            else if (contextType) {
                // Type-wide permissions
                where.contextId = null;
                where.contextType = contextType;
            }
            else {
                // Global permissions only
                where.contextId = null;
                where.contextType = null;
            }
            // Query user permissions with included permission details
            const userPermissions = await this.db.userPermission.findMany({
                where,
                include: { permission: true },
            });
            // Extract and return just the permission objects
            return userPermissions.map((up) => up.permission);
        }, {
            action: 'permission.user.list',
            success: true,
            targetUserId: userId,
            contextId,
            metadata: { contextType },
        }, serviceContext);
    }
    /**
     * Gets all permissions assigned to a role in a specific context
     *
     * This method retrieves permissions that are assigned to a specific role.
     * It's used internally for calculating effective permissions and can also
     * be used for role management operations.
     *
     * @param params.roleId - The role's unique identifier
     * @param params.contextId - Optional specific context ID for context-scoped permissions
     * @param params.contextType - Optional context type for type-wide permissions
     * @param params.context - Optional service context
     * @returns Promise resolving to array of Permission objects
     *
     * @throws ServiceError.notFound if role doesn't exist
     * @throws ServiceError.validationError if inputs are invalid
     *
     * Example:
     * const permissions = await permissionService.getRolePermissions({
     *   roleId: 'role_123',
     *   contextId: 'org_456'
     * });
     */
    async getRolePermissions(params) {
        const { roleId, contextId, contextType, context: serviceContext } = params;
        // Validate required inputs
        this.validateString(roleId, 'role id');
        return this.execute(async () => {
            // Verify the role exists before querying permissions
            const role = await this.db.role.findUnique({ where: { id: roleId } });
            if (!role) {
                throw base_service_1.ServiceError.notFound('Role', roleId);
            }
            // Build the where clause based on the provided context parameters
            const where = { roleId };
            if (contextId) {
                // Context-specific permissions
                where.contextId = contextId;
            }
            else if (contextType) {
                // Type-wide permissions
                where.contextId = null;
                where.contextType = contextType;
            }
            else {
                // Global permissions only
                where.contextId = null;
                where.contextType = null;
            }
            // Query role permissions with included permission details
            const rolePermissions = await this.db.rolePermission.findMany({
                where,
                include: { permission: true },
            });
            // Extract and return just the permission objects
            return rolePermissions.map((rp) => rp.permission);
        }, {
            action: 'permission.role.list',
            success: true,
            resourceType: 'role',
            resourceId: roleId,
            contextId,
            metadata: { contextType },
        }, serviceContext);
    }
    /**
     * Gets all effective permissions for a user (direct + role-based)
     *
     * This method calculates the complete set of permissions a user has by
     * combining direct permission grants with permissions inherited from
     * their assigned roles. It handles permission deduplication and
     * context-aware permission resolution.
     *
     * @param params.userId - The user's unique identifier
     * @param params.contextId - Optional specific context ID for context-scoped permissions
     * @param params.contextType - Optional context type for type-wide permissions
     * @param params.context - Optional service context
     * @returns Promise resolving to array of unique Permission objects
     *
     * @throws ServiceError.notFound if user doesn't exist
     * @throws ServiceError.validationError if inputs are invalid
     *
     * Example:
     * const effectivePermissions = await permissionService.getUserEffectivePermissions({
     *   userId: 'user_123',
     *   contextId: 'org_456'
     * });
     */
    async getUserEffectivePermissions(params) {
        const { userId, contextId, contextType, context: serviceContext } = params;
        // Validate required inputs
        this.validateString(userId, 'user id');
        return this.execute(async () => {
            // Verify the user exists before calculating permissions
            await this.ensureUserExists(userId);
            // Get direct user permissions
            const userPermissions = await this.getUserPermissions({
                userId,
                contextId,
                contextType,
            });
            // Get permissions from user's roles
            // Query for user roles that are either global or match the specific context
            const userRoles = await this.db.userRole.findMany({
                where: {
                    userId,
                    OR: [
                        { contextId: null }, // Global roles
                        ...(contextId ? [{ contextId }] : []), // Context-specific roles
                    ],
                },
                include: { role: true },
            });
            // Collect all permissions from user's roles
            let rolePermissions = [];
            const roleIds = userRoles.map((userRole) => userRole.roleId);
            if (roleIds.length > 0) {
                const where = {
                    roleId: { in: roleIds },
                };
                if (contextId) {
                    where.contextId = contextId;
                }
                else if (contextType) {
                    where.contextId = null;
                    where.contextType = contextType;
                }
                else {
                    where.contextId = null;
                    where.contextType = null;
                }
                const rolePermissionRecords = await this.db.rolePermission.findMany({
                    where,
                    include: { permission: true },
                });
                rolePermissions = rolePermissionRecords.map((rp) => rp.permission);
            }
            // Combine and deduplicate permissions
            // Direct permissions take precedence over role-based permissions
            const allPermissions = [...userPermissions, ...rolePermissions];
            const uniquePermissions = new Map();
            for (const permission of allPermissions) {
                uniquePermissions.set(permission.key, permission);
            }
            return Array.from(uniquePermissions.values());
        }, {
            action: 'permission.user.effective',
            success: true,
            targetUserId: userId,
            contextId,
            metadata: { contextType },
        }, serviceContext);
    }
    /**
     * Checks if a user has a specific permission
     *
     * This method provides a convenient way to check if a user has a particular
     * permission by calculating their effective permissions and checking for
     * the presence of the specified permission key.
     *
     * @param params.userId - The user's unique identifier
     * @param params.permissionKey - The permission key to check
     * @param params.contextId - Optional specific context ID for context-scoped permissions
     * @param params.contextType - Optional context type for type-wide permissions
     * @param params.context - Optional service context
     * @returns Promise resolving to boolean indicating if user has the permission
     *
     * @throws ServiceError.notFound if user doesn't exist
     * @throws ServiceError.validationError if inputs are invalid
     *
     * Example:
     * const hasPermission = await permissionService.checkUserPermission({
     *   userId: 'user_123',
     *   permissionKey: 'users:write',
     *   contextId: 'org_456'
     * });
     */
    async checkUserPermission(params) {
        const { userId, permissionKey, contextId, contextType, context: serviceContext } = params;
        // Validate required inputs
        this.validateString(userId, 'user id');
        this.validateString(permissionKey, 'permission key');
        return this.execute(async () => {
            // Get the user's effective permissions
            const permissions = await this.getUserEffectivePermissions({
                userId,
                contextId,
                contextType,
            });
            // Convert permissions to a Set of permission keys for wildcard matching
            const permissionKeys = new Set(permissions.map(p => p.key));
            // Use the shared permission registry for wildcard checks
            const hasPermission = this.permissionRegistry.isAllowed(permissionKey, permissionKeys);
            return hasPermission;
        }, {
            action: 'permission.user.check',
            success: true,
            targetUserId: userId,
            contextId,
            resourceType: 'permission',
            resourceId: permissionKey,
            metadata: { permissionKey, contextType },
        }, serviceContext);
    }
    async ensureUserExists(userId, client = this.db) {
        const user = await client.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw base_service_1.ServiceError.notFound('User', userId);
        }
    }
    async ensureContextExists(contextId, client = this.db) {
        const context = await client.context.findUnique({ where: { id: contextId } });
        if (!context) {
            throw base_service_1.ServiceError.notFound('Context', contextId);
        }
    }
    /**
     * Grants multiple permissions to a user in a single operation
     *
     * This method provides bulk permission granting functionality, which is
     * more efficient than granting permissions one by one. It uses a transaction
     * to ensure all permissions are granted atomically.
     *
     * @param params.userId - The user's unique identifier
     * @param params.permissions - Array of permission objects to grant
     * @param params.context - Optional service context
     * @returns Promise resolving to array of created UserPermission records
     *
     * @throws ServiceError.notFound if user or any context doesn't exist
     * @throws ServiceError.validationError if inputs are invalid
     *
     * Example:
     * const results = await permissionService.bulkGrantToUser({
     *   userId: 'user_123',
     *   permissions: [
     *     { key: 'users:read', contextId: 'org_456' },
     *     { key: 'users:write', contextId: 'org_456' }
     *   ]
     * });
     */
    async bulkGrantToUser(params) {
        const { userId, permissions, context: serviceContext } = params;
        // Validate required inputs
        this.validateString(userId, 'user id');
        if (!Array.isArray(permissions) || permissions.length === 0) {
            throw base_service_1.ServiceError.validationError('At least one permission must be provided');
        }
        return this.execute(async () => {
            // Verify the user exists before granting permissions
            await this.ensureUserExists(userId);
            const results = [];
            // Use transaction for bulk operations to ensure atomicity
            await this.withTransaction(async (tx) => {
                for (const perm of permissions) {
                    // Validate each permission
                    this.validateString(perm.permissionKey, 'permission key');
                    // Verify context exists if provided
                    if (perm.contextId) {
                        await this.ensureContextExists(perm.contextId, tx);
                    }
                    // Create or find the permission
                    const permission = await tx.permission.upsert({
                        where: { key: perm.permissionKey },
                        update: {},
                        create: { key: perm.permissionKey, label: perm.permissionKey },
                    });
                    // Create the user-permission link
                    const id = `${userId}-${permission.id}-${perm.contextId ?? 'global'}`;
                    const userPermission = await tx.userPermission.upsert({
                        where: { id },
                        update: {},
                        create: {
                            id,
                            userId,
                            permissionId: permission.id,
                            contextId: perm.contextId ?? null,
                            contextType: perm.contextId ? null : (perm.contextType ?? null),
                        },
                    });
                    results.push(userPermission);
                }
            });
            return results;
        }, {
            action: 'permission.user.bulk.granted',
            success: true,
            targetUserId: userId,
            resourceType: 'permission',
            metadata: {
                permissionCount: permissions.length,
                permissions: permissions.map(p => ({ key: p.permissionKey, contextId: p.contextId, contextType: p.contextType }))
            },
        }, serviceContext);
    }
}
exports.UserPermissionService = UserPermissionService;
