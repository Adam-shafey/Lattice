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
import { BaseService, type ServiceContext } from './base-service';
import { IPermissionService } from './interfaces';
import type { PrismaClient, Permission, UserPermission } from '../db/db-client';
import { PermissionRegistry } from '../permissions/permission-registry';
/**
 * UserPermissionService Class
 *
 * Implements the IPermissionService interface and provides all permission-related
 * operations for users. Extends BaseService to inherit common functionality like
 * validation and transaction management.
 */
export declare class UserPermissionService extends BaseService implements IPermissionService {
    private readonly permissionRegistry;
    constructor(db: PrismaClient, permissionRegistry: PermissionRegistry);
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
    grantToUser(params: {
        userId: string;
        permissionKey: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<UserPermission>;
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
    revokeFromUser(params: {
        userId: string;
        permissionKey: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<void>;
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
    getUserPermissions(params: {
        userId: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<Permission[]>;
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
    getRolePermissions(params: {
        roleId: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<Permission[]>;
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
    getUserEffectivePermissions(params: {
        userId: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<Permission[]>;
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
    checkUserPermission(params: {
        userId: string;
        permissionKey: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<boolean>;
    private ensureUserExists;
    private ensureContextExists;
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
    bulkGrantToUser(params: {
        userId: string;
        permissions: Array<{
            permissionKey: string;
            contextId?: string | null;
            contextType?: string | null;
        }>;
        context?: ServiceContext;
    }): Promise<UserPermission[]>;
}
