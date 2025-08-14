import { getDbClient } from '../db/db-client';

export interface EffectivePermissionsQuery {
  userId: string;
  contextId?: string | null;
}

export async function fetchEffectivePermissions({ userId, contextId }: EffectivePermissionsQuery): Promise<Set<string>> {
  const db = getDbClient();
  const targetContextId = contextId ?? null;

  // Gather user direct permissions (global and in-context)
  const userPerms = await db.userPermission.findMany({
    where: {
      userId,
      OR: [{ contextId: null }, { contextId: targetContextId }],
    },
    include: { permission: true },
  });

  // Roles assigned to the user globally or within the context
  const userRoles = await db.userRole.findMany({
    where: {
      userId,
      OR: [{ contextId: null }, { contextId: targetContextId }],
    },
    select: { roleId: true },
  });
  const roleIds = [...new Set(userRoles.map((r) => r.roleId))];

  // Role permissions (global and in-context)
  const rolePerms = roleIds.length
    ? await db.rolePermission.findMany({
        where: {
          roleId: { in: roleIds },
          OR: [{ contextId: null }, { contextId: targetContextId }],
        },
        include: { permission: true },
      })
    : [];

  const result = new Set<string>();
  for (const up of userPerms) result.add(up.permission.key);
  for (const rp of rolePerms) result.add(rp.permission.key);
  return result;
}


