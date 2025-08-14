import { getDbClient } from '../db/db-client';

export class RoleService {
  async createRole(name: string) {
    const db = getDbClient();
    return db.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  async deleteRole(name: string) {
    const db = getDbClient();
    const role = await db.role.findUnique({ where: { name } });
    if (!role) return;
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId: role.id } }),
      db.userRole.deleteMany({ where: { roleId: role.id } }),
      db.role.delete({ where: { id: role.id } }),
    ]);
  }

  async listRoles() {
    const db = getDbClient();
    return db.role.findMany({ orderBy: { name: 'asc' } });
  }

  async assignRoleToUser(params: { roleName: string; userId: string; contextId?: string | null }) {
    const db = getDbClient();
    const role = await db.role.upsert({ where: { name: params.roleName }, update: {}, create: { name: params.roleName } });
    const id = `${params.userId}-${role.id}-${params.contextId ?? 'global'}`;
    return db.userRole.upsert({
      where: { id },
      update: {},
      create: { id, userId: params.userId, roleId: role.id, contextId: params.contextId ?? null },
    });
  }

  async removeRoleFromUser(params: { roleName: string; userId: string; contextId?: string | null }) {
    const db = getDbClient();
    const role = await db.role.findUnique({ where: { name: params.roleName } });
    if (!role) return;
    const id = `${params.userId}-${role.id}-${params.contextId ?? 'global'}`;
    await db.userRole.delete({ where: { id } }).catch(() => {});
  }

  async addPermissionToRole(params: { roleName: string; permissionKey: string; contextId?: string | null }) {
    const db = getDbClient();
    const role = await db.role.upsert({ where: { name: params.roleName }, update: {}, create: { name: params.roleName } });
    const perm = await db.permission.upsert({ where: { key: params.permissionKey }, update: {}, create: { key: params.permissionKey, label: params.permissionKey } });
    const id = `${role.id}-${perm.id}-${params.contextId ?? 'global'}`;
    return db.rolePermission.upsert({
      where: { id },
      update: {},
      create: { id, roleId: role.id, permissionId: perm.id, contextId: params.contextId ?? null },
    });
  }

  async removePermissionFromRole(params: { roleName: string; permissionKey: string; contextId?: string | null }) {
    const db = getDbClient();
    const role = await db.role.findUnique({ where: { name: params.roleName } });
    if (!role) return;
    const perm = await db.permission.findUnique({ where: { key: params.permissionKey } });
    if (!perm) return;
    const id = `${role.id}-${perm.id}-${params.contextId ?? 'global'}`;
    await db.rolePermission.delete({ where: { id } }).catch(() => {});
  }

  async listUserRoles(params: { userId: string; contextId?: string | null }) {
    const db = getDbClient();
    const roles = await db.userRole.findMany({
      where: {
        userId: params.userId,
        OR: [
          { contextId: null },
          ...(params.contextId ? [{ contextId: params.contextId }] as any : []),
        ],
      },
      include: { role: true },
    });
    return roles.map((r) => ({ name: r.role.name, contextId: r.contextId }));
  }
}


