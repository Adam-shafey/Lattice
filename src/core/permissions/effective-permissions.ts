import { db } from '../db/db-client';

export interface EffectivePermissionsQuery {
  userId: string;
  context?: { type: string; id: string | null } | null;
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
  console.log('📋 [FETCH_EFFECTIVE] Starting fetchEffectivePermissions');
  console.log('📋 [FETCH_EFFECTIVE] userId:', userId);
  console.log('📋 [FETCH_EFFECTIVE] context:', context);
  
  const targetContextId = context?.id ?? null;
  const targetContextType = context?.type ?? null;
  
  console.log('📋 [FETCH_EFFECTIVE] targetContextId:', targetContextId);
  console.log('📋 [FETCH_EFFECTIVE] targetContextType:', targetContextType);

  // Gather user direct permissions (global, type-wide, and context-specific)
  console.log('📋 [FETCH_EFFECTIVE] Fetching user direct permissions...');
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
  
  console.log('📋 [FETCH_EFFECTIVE] User direct permissions found:', userPerms.length);
  console.log('📋 [FETCH_EFFECTIVE] User direct permissions:', userPerms.map(up => ({
    permissionKey: up.permission.key,
    contextId: up.contextId,
    contextType: up.contextType
  })));

  // Find roles assigned to the user (global and context-specific)
  console.log('📋 [FETCH_EFFECTIVE] Fetching user roles...');
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
  console.log('📋 [FETCH_EFFECTIVE] User roles found:', userRoles.length);
  console.log('📋 [FETCH_EFFECTIVE] Unique role IDs:', roleIds);

  // Gather role permissions (global, type-wide, and context-specific)
  let rolePerms: any[] = [];
  if (roleIds.length > 0) {
    console.log('📋 [FETCH_EFFECTIVE] Fetching role permissions...');
    rolePerms = await db.rolePermission.findMany({
      where: {
        roleId: { in: roleIds },
        OR: [
          { contextId: null, contextType: null }, // global
          { contextId: null, contextType: targetContextType }, // type-wide
          { contextId: targetContextId }, // exact context
        ],
      },
      include: { permission: true },
    });
  }
  
  console.log('📋 [FETCH_EFFECTIVE] Role permissions found:', rolePerms.length);
  console.log('📋 [FETCH_EFFECTIVE] Role permissions:', rolePerms.map(rp => ({
    permissionKey: rp.permission.key,
    roleId: rp.roleId,
    contextId: rp.contextId,
    contextType: rp.contextType
  })));

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
  
  console.log('📋 [FETCH_EFFECTIVE] Final combined permissions count:', result.size);
  console.log('📋 [FETCH_EFFECTIVE] Final combined permissions:', Array.from(result));
  
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


