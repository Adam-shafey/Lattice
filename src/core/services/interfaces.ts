/**
 * Service Interfaces for Lattice Core
 * 
 * This file defines TypeScript interfaces for all core services. These interfaces
 * establish clear contracts for service methods and return types, enabling:
 * - Type safety across the application
 * - Easy mocking and testing
 * - Clear documentation of service capabilities
 * - Consistent API patterns
 */

import type { User, Role, Permission, Context, UserRole, RolePermission, UserPermission } from '../db/db-client';
import type { ServiceContext } from './base-service';

/**
 * User Service Interface
 * 
 * Defines operations for user management including:
 * - User creation and authentication
 * - User profile management
 * - Password management
 * - User listing and search
 */
export interface IUserService {
  /**
   * Creates a new user with the specified email and password
   * @param params.email - User's email address
   * @param params.password - User's password (will be hashed)
   * @param params.context - Optional service context
   * @returns Promise resolving to the created User
   */
  createUser(params: {
    email: string;
    password: string;
    context?: ServiceContext;
  }): Promise<User>;

  /**
   * Retrieves a user by their unique ID
   * @param id - User's unique identifier
   * @param context - Optional service context
   * @returns Promise resolving to User or null if not found
   */
  getUserById(id: string, context?: ServiceContext): Promise<User | null>;

  /**
   * Retrieves a user by their email address
   * @param email - User's email address
   * @param context - Optional service context
   * @returns Promise resolving to User or null if not found
   */
  getUserByEmail(email: string, context?: ServiceContext): Promise<User | null>;

  /**
   * Updates a user's profile information
   * @param id - User's unique identifier
   * @param updates - Object containing fields to update
   * @param context - Optional service context
   * @returns Promise resolving to the updated User
   */
  updateUser(id: string, updates: {
    email?: string;
    password?: string;
  }, context?: ServiceContext): Promise<User>;

  /**
   * Permanently deletes a user and all associated data
   * @param id - User's unique identifier
   * @param context - Optional service context
   * @returns Promise that resolves when deletion is complete
   */
  deleteUser(id: string, context?: ServiceContext): Promise<void>;

  /**
   * Lists users with optional pagination
   * @param params.limit - Maximum number of users to return
   * @param params.offset - Number of users to skip (for pagination)
   * @param params.context - Optional service context
   * @returns Promise resolving to object containing users array and total count
   */
  listUsers(params?: {
    limit?: number;
    offset?: number;
    context?: ServiceContext;
  }): Promise<{ users: User[]; total: number }>;

  /**
   * Changes a user's password with old password verification
   * @param userId - User's unique identifier
   * @param oldPassword - Current password for verification
   * @param newPassword - New password to set
   * @param context - Optional service context
   * @returns Promise that resolves when password is changed
   */
  changePassword(userId: string, oldPassword: string, newPassword: string, context?: ServiceContext): Promise<void>;

  /**
   * Verifies a user's password
   * @param userId - User's unique identifier
   * @param password - Password to verify
   * @returns Promise resolving to boolean indicating if password is correct
   */
  verifyPassword(userId: string, password: string): Promise<boolean>;
}

/**
 * Role Service Interface
 * 
 * Defines operations for role management including:
 * - Role creation and management
 * - Role assignment to users
 * - Permission management within roles
 * - Context-aware role operations
 */
export interface IRoleService {
  /**
   * Creates a new role with the specified name and context type
   * @param params.name - Role name (e.g., 'admin', 'member')
   * @param params.contextType - Type of context this role applies to (e.g., 'organization')
   * @param params.key - Optional unique key for the role
   * @param params.context - Optional service context
   * @returns Promise resolving to the created Role
   */
  createRole(params: {
    name: string;
    contextType: string;
    key?: string;
    context?: ServiceContext;
  }): Promise<Role>;

  /**
   * Retrieves a role by its name
   * @param name - Role name to search for
   * @param context - Optional service context
   * @returns Promise resolving to Role or null if not found
   */
  getRoleByName(name: string, context?: ServiceContext): Promise<Role | null>;

  /**
   * Retrieves a role by its unique key
   * @param key - Role key to search for
   * @param context - Optional service context
   * @returns Promise resolving to Role or null if not found
   */
  getRoleByKey(key: string, context?: ServiceContext): Promise<Role | null>;

  /**
   * Permanently deletes a role and removes all assignments
   * @param nameOrKey - Role name or key to delete
   * @param context - Optional service context
   * @returns Promise that resolves when deletion is complete
   */
  deleteRole(nameOrKey: string, context?: ServiceContext): Promise<void>;

  /**
   * Lists roles with optional filtering by context type
   * @param params.contextType - Optional context type filter
   * @param params.context - Optional service context
   * @returns Promise resolving to array of Roles
   */
  listRoles(params?: {
    contextType?: string;
    context?: ServiceContext;
  }): Promise<Role[]>;

  /**
   * Assigns a role to a user in a specific context
   * @param params.roleName - Role name to assign (or use roleKey)
   * @param params.roleKey - Role key to assign (or use roleName)
   * @param params.userId - User's unique identifier
   * @param params.contextId - Specific context ID (optional for global roles)
   * @param params.contextType - Context type for type-wide roles (optional)
   * @param params.context - Optional service context
   * @returns Promise resolving to the created UserRole assignment
   */
  assignRoleToUser(params: {
    roleName?: string;
    roleKey?: string;
    userId: string;
    contextId?: string | null;
    contextType?: string | null;
    context?: ServiceContext;
  }): Promise<UserRole>;

  /**
   * Removes a role assignment from a user
   * @param params.roleName - Role name to remove (or use roleKey)
   * @param params.roleKey - Role key to remove (or use roleName)
   * @param params.userId - User's unique identifier
   * @param params.contextId - Specific context ID (optional for global roles)
   * @param params.contextType - Context type for type-wide roles (optional)
   * @param params.context - Optional service context
   * @returns Promise that resolves when role is removed
   */
  removeRoleFromUser(params: {
    roleName?: string;
    roleKey?: string;
    userId: string;
    contextId?: string | null;
    contextType?: string | null;
    context?: ServiceContext;
  }): Promise<void>;

  /**
   * Adds a permission to a role in a specific context
   * @param params.roleName - Role name (or use roleKey)
   * @param params.roleKey - Role key (or use roleName)
   * @param params.permissionKey - Permission key to add
   * @param params.contextId - Specific context ID (optional for global permissions)
   * @param params.contextType - Context type for type-wide permissions (optional)
   * @param params.context - Optional service context
   * @returns Promise resolving to the created RolePermission
   */
  addPermissionToRole(params: {
    roleName?: string;
    roleKey?: string;
    permissionKey: string;
    contextId?: string | null;
    contextType?: string | null;
    context?: ServiceContext;
  }): Promise<RolePermission>;

  /**
   * Removes a permission from a role
   * @param params.roleName - Role name (or use roleKey)
   * @param params.roleKey - Role key (or use roleName)
   * @param params.permissionKey - Permission key to remove
   * @param params.contextId - Specific context ID (optional for global permissions)
   * @param params.contextType - Context type for type-wide permissions (optional)
   * @param params.context - Optional service context
   * @returns Promise that resolves when permission is removed
   */
  removePermissionFromRole(params: {
    roleName?: string;
    roleKey?: string;
    permissionKey: string;
    contextId?: string | null;
    contextType?: string | null;
    context?: ServiceContext;
  }): Promise<void>;

  /**
   * Lists all roles assigned to a user in a specific context
   * @param params.userId - User's unique identifier
   * @param params.contextId - Specific context ID (optional for global roles)
   * @param params.context - Optional service context
   * @returns Promise resolving to array of role assignments with names and context IDs
   */
  listUserRoles(params: {
    userId: string;
    contextId?: string | null;
    context?: ServiceContext;
  }): Promise<Array<{ name: string; contextId: string | null }>>;
}

/**
 * Permission Service Interface
 * 
 * Defines operations for permission management including:
 * - Direct permission grants to users
 * - Permission revocation from users
 * - Permission queries and checks
 * - Context-aware permission operations
 */
export interface IPermissionService {
  /**
   * Grants a permission directly to a user in a specific context
   * @param params.userId - User's unique identifier
   * @param params.permissionKey - Permission key to grant
   * @param params.contextId - Specific context ID (optional for global permissions)
   * @param params.contextType - Context type for type-wide permissions (optional)
   * @param params.context - Optional service context
   * @returns Promise resolving to the created UserPermission
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
   * @param params.userId - User's unique identifier
   * @param params.permissionKey - Permission key to revoke
   * @param params.contextId - Specific context ID (optional for global permissions)
   * @param params.contextType - Context type for type-wide permissions (optional)
   * @param params.context - Optional service context
   * @returns Promise that resolves when permission is revoked
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
   * @param params.userId - User's unique identifier
   * @param params.contextId - Specific context ID (optional for global permissions)
   * @param params.contextType - Context type for type-wide permissions (optional)
   * @param params.context - Optional service context
   * @returns Promise resolving to array of Permissions
   */
  getUserPermissions(params: {
    userId: string;
    contextId?: string | null;
    contextType?: string | null;
    context?: ServiceContext;
  }): Promise<Permission[]>;

  /**
   * Gets all permissions assigned to a role in a specific context
   * @param params.roleId - Role's unique identifier
   * @param params.contextId - Specific context ID (optional for global permissions)
   * @param params.contextType - Context type for type-wide permissions (optional)
   * @param params.context - Optional service context
   * @returns Promise resolving to array of Permissions
   */
  getRolePermissions(params: {
    roleId: string;
    contextId?: string | null;
    contextType?: string | null;
    context?: ServiceContext;
  }): Promise<Permission[]>;

  /**
   * Checks if a user has a specific permission in a context
   * @param params.userId - User's unique identifier
   * @param params.permissionKey - Permission key to check
   * @param params.contextId - Specific context ID (optional for global permissions)
   * @param params.contextType - Context type for type-wide permissions (optional)
   * @param params.context - Optional service context
   * @returns Promise resolving to boolean indicating if user has permission
   */
  checkUserPermission(params: {
    userId: string;
    permissionKey: string;
    contextId?: string | null;
    contextType?: string | null;
    context?: ServiceContext;
  }): Promise<boolean>;

  /**
   * Gets all effective permissions for a user (direct + role-based) in a context
   * @param params.userId - User's unique identifier
   * @param params.contextId - Specific context ID (optional for global permissions)
   * @param params.contextType - Context type for type-wide permissions (optional)
   * @param params.context - Optional service context
   * @returns Promise resolving to array of effective Permissions
   */
  getUserEffectivePermissions(params: {
    userId: string;
    contextId?: string | null;
    contextType?: string | null;
    context?: ServiceContext;
  }): Promise<Permission[]>;

  /**
   * Grants multiple permissions to a user in a single operation
   * @param params.userId - User's unique identifier
   * @param params.permissions - Array of permission objects to grant
   * @param params.context - Optional service context
   * @returns Promise resolving to array of created UserPermissions
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

/**
 * Context Service Interface
 * 
 * Defines operations for context management including:
 * - Context resolution from requests
 * - Context creation and management
 * - User membership in contexts
 */
export interface IContextService {
  /**
   * Resolves a context from various request sources
   * @param input.routeParam - Context ID from route parameter
   * @param input.header - Context ID from request header
   * @param input.query - Context ID from query parameter
   * @returns Resolved context object or null if not found
   */
  resolveContext(input: {
    routeParam?: string | null;
    header?: string | null;
    query?: string | null;
  }): { id: string } | null;

  /**
   * Creates a new context with the specified type and name
   * @param params.id - Unique context identifier
   * @param params.type - Context type (e.g., 'organization', 'team')
   * @param params.name - Optional display name for the context
   * @param params.context - Optional service context
   * @returns Promise resolving to the created Context
   */
  createContext(params: {
    id: string;
    type: string;
    name?: string;
    context?: ServiceContext;
  }): Promise<Context>;

  /**
   * Retrieves a context by its unique ID
   * @param id - Context's unique identifier
   * @param context - Optional service context
   * @returns Promise resolving to Context or null if not found
   */
  getContext(id: string, context?: ServiceContext): Promise<Context | null>;

  /**
   * Updates a context's properties
   * @param id - Context's unique identifier
   * @param updates - Object containing fields to update
   * @param context - Optional service context
   * @returns Promise resolving to the updated Context
   */
  updateContext(id: string, updates: {
    name?: string;
    type?: string;
  }, context?: ServiceContext): Promise<Context>;

  /**
   * Permanently deletes a context and all associated data
   * @param id - Context's unique identifier
   * @param context - Optional service context
   * @returns Promise that resolves when deletion is complete
   */
  deleteContext(id: string, context?: ServiceContext): Promise<void>;

  /**
   * Lists contexts with optional filtering and pagination
   * @param params.type - Optional context type filter
   * @param params.limit - Maximum number of contexts to return
   * @param params.offset - Number of contexts to skip (for pagination)
   * @param params.context - Optional service context
   * @returns Promise resolving to object containing contexts array and total count
   */
  listContexts(params?: {
    type?: string;
    limit?: number;
    offset?: number;
    context?: ServiceContext;
  }): Promise<{ contexts: Context[]; total: number }>;

  /**
   * Adds a user to a context (creates membership)
   * @param params.userId - User's unique identifier
   * @param params.contextId - Context's unique identifier
   * @param params.context - Optional service context
   * @returns Promise that resolves when user is added to context
   */
  addUserToContext(params: {
    userId: string;
    contextId: string;
    context?: ServiceContext;
  }): Promise<void>;

  /**
   * Removes a user from a context (removes membership)
   * @param params.userId - User's unique identifier
   * @param params.contextId - Context's unique identifier
   * @param params.context - Optional service context
   * @returns Promise that resolves when user is removed from context
   */
  removeUserFromContext(params: {
    userId: string;
    contextId: string;
    context?: ServiceContext;
  }): Promise<void>;

  /**
   * Gets all users who are members of a specific context
   * @param params.contextId - Context's unique identifier
   * @param params.context - Optional service context
   * @returns Promise resolving to array of Users
   */
  getContextUsers(params: {
    contextId: string;
    context?: ServiceContext;
  }): Promise<User[]>;
}

/**
 * Service Factory Interface
 * 
 * Defines the factory pattern for creating and managing service instances.
 * This interface ensures consistent service instantiation and dependency injection.
 */
export interface IServiceFactory {
  /**
   * Gets the user service instance
   * @returns IUserService instance
   */
  getUserService(): IUserService;
  
  /**
   * Gets the role service instance
   * @returns IRoleService instance
   */
  getRoleService(): IRoleService;
  
  /**
   * Gets the permission service instance
   * @returns IPermissionService instance
   */
  getPermissionService(): IPermissionService;
  
  /**
   * Gets the context service instance
   * @returns IContextService instance
   */
  getContextService(): IContextService;
}
