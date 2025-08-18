import type { PrismaClient } from '../db/db-client';
export interface EffectivePermissionsQuery {
    userId: string;
    context?: {
        type: string;
        id: string | null;
    } | null;
}
/**
 * Fetches effective permissions for a user in a specific context
 *
 * This function calculates the complete set of permissions a user has by:
 * 1. Gathering direct user permissions (global, type-wide, and context-specific)
 * 2. Finding all roles assigned to the user (global and context-specific)
 * 3. Gathering permissions from those roles (global, type-wide, and context-specific)
 * 4. Combining all permissions into a single set
 *
 * @param params.userId - The user's unique identifier
 * @param params.context - Optional context with type and id for scoped permissions
 * @returns Promise resolving to a Set of permission keys
 */
export declare function fetchEffectivePermissions(db: PrismaClient, { userId, context }: EffectivePermissionsQuery): Promise<Set<string>>;
/**
 * Checks if a user has a specific permission in a context
 *
 * @param userId - The user's unique identifier
 * @param permissionKey - The permission key to check
 * @param context - Optional context with type and id for scoped permissions
 * @returns Promise resolving to boolean indicating if user has the permission
 */
export declare function checkUserPermission(db: PrismaClient, userId: string, permissionKey: string, context?: {
    type: string;
    id: string;
} | null): Promise<boolean>;
