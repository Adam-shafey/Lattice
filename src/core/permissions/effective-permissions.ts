import { db } from '../db/db-client';

export interface EffectivePermissionsQuery {
  userId: string;
  context?: { type: string; id: string } | null;
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
export async function fetchEffectivePermissions({ userId, context }: EffectivePermissionsQuery): Promise<Set<string>> {
  const targetContextId = context?.id ?? null;
  const targetContextType = context?.type ?? null;

  // Gather user direct permissions (global, type-wide, and context-specific)
  const userPerms = await db.userPermission.findMany({
    where: {
      userId,
      OR: [
        { contextId: null, contextType: null }, // global
        { contextId: null, contextType: targetContextType }, // type-wide
        { contextId: targetContextId }, // exact context
      ],
    },
    include: { permission: true },
  });

  // Find roles assigned to the user (global and context-specific)
  const userRoles = await db.userRole.findMany({
    where: {
      userId,
      OR: [
        { contextId: null }, // global roles
        { contextId: targetContextId }, // context-specific roles
      ],
    },
    select: { roleId: true },
  });

  const roleIds = [...new Set(userRoles.map((r: { roleId: string }) => r.roleId))];

  // Gather role permissions (global, type-wide, and context-specific)
  const rolePerms = roleIds.length > 0
    ? await db.rolePermission.findMany({
        where: {
          roleId: { in: roleIds },
          OR: [
            { contextId: null, contextType: null }, // global
            { contextId: null, contextType: targetContextType }, // type-wide
            { contextId: targetContextId }, // exact context
          ],
        },
        include: { permission: true },
      })
    : [];

  // Combine all permissions into a single set
  const result = new Set<string>();
  
  // Add direct user permissions
  for (const up of userPerms) {
    result.add(up.permission.key);
  }
  
  // Add role-based permissions
  for (const rp of rolePerms) {
    result.add(rp.permission.key);
  }
  
  return result;
}

/**
 * Checks if a user has a specific permission in a context
 * 
 * @param userId - The user's unique identifier
 * @param permissionKey - The permission key to check
 * @param context - Optional context with type and id for scoped permissions
 * @returns Promise resolving to boolean indicating if user has the permission
 */
export async function checkUserPermission(
  userId: string, 
  permissionKey: string, 
  context?: { type: string; id: string } | null
): Promise<boolean> {
  const effectivePermissions = await fetchEffectivePermissions({ userId, context });
  return effectivePermissions.has(permissionKey);
}


