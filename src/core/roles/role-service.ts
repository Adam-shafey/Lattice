import { getDbClient } from '../db/db-client';
import { AuditService } from '../audit/audit-service';

export class RoleService {
  private readonly audit = new AuditService();

  async createRole(name: string, options?: { actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = await db.role.upsert({ where: { name }, update: {}, create: { name } });
    await this.audit.log({
      userId: options?.actorId ?? null,
      contextId: null,
      action: 'role.created',
      success: true,
      metadata: { roleName: name, source: options?.source, reason: options?.reason },
    });
    return role;
  }

  async deleteRole(name: string, options?: { actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = await db.role.findUnique({ where: { name } });
    if (!role) return;
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId: role.id } }),
      db.userRole.deleteMany({ where: { roleId: role.id } }),
      db.role.delete({ where: { id: role.id } }),
    ]);
    await this.audit.log({
      userId: options?.actorId ?? null,
      contextId: null,
      action: 'role.deleted',
      success: true,
      metadata: { roleName: name, source: options?.source, reason: options?.reason },
    });
  }

  async listRoles() {
    const db = getDbClient();
    return db.role.findMany({ orderBy: { name: 'asc' } });
  }

  async assignRoleToUser(params: { roleName: string; userId: string; contextId?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = await db.role.upsert({ where: { name: params.roleName }, update: {}, create: { name: params.roleName } });
    const id = `${params.userId}-${role.id}-${params.contextId ?? 'global'}`;
    const res = await db.userRole.upsert({
      where: { id },
      update: {},
      create: { id, userId: params.userId, roleId: role.id, contextId: params.contextId ?? null },
    });
    await this.audit.log({
      userId: params.actorId ?? null,
      contextId: params.contextId ?? null,
      action: 'role.assigned',
      success: true,
      metadata: { roleName: params.roleName, targetUserId: params.userId, source: params.source, reason: params.reason },
    });
    return res;
  }

  async removeRoleFromUser(params: { roleName: string; userId: string; contextId?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = await db.role.findUnique({ where: { name: params.roleName } });
    if (!role) return;
    const id = `${params.userId}-${role.id}-${params.contextId ?? 'global'}`;
    await db.userRole.delete({ where: { id } }).catch(() => {});
    await this.audit.log({
      userId: params.actorId ?? null,
      contextId: params.contextId ?? null,
      action: 'role.removed',
      success: true,
      metadata: { roleName: params.roleName, targetUserId: params.userId, source: params.source, reason: params.reason },
    });
  }

  async addPermissionToRole(params: { roleName: string; permissionKey: string; contextId?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = await db.role.upsert({ where: { name: params.roleName }, update: {}, create: { name: params.roleName } });
    const perm = await db.permission.upsert({ where: { key: params.permissionKey }, update: {}, create: { key: params.permissionKey, label: params.permissionKey } });
    const id = `${role.id}-${perm.id}-${params.contextId ?? 'global'}`;
    const res = await db.rolePermission.upsert({
      where: { id },
      update: {},
      create: { id, roleId: role.id, permissionId: perm.id, contextId: params.contextId ?? null },
    });
    await this.audit.log({
      userId: params.actorId ?? null,
      contextId: params.contextId ?? null,
      action: 'permission.role.granted',
      success: true,
      metadata: { roleName: params.roleName, permissionKey: params.permissionKey, source: params.source, reason: params.reason },
    });
    return res;
  }

  async removePermissionFromRole(params: { roleName: string; permissionKey: string; contextId?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = await db.role.findUnique({ where: { name: params.roleName } });
    if (!role) return;
    const perm = await db.permission.findUnique({ where: { key: params.permissionKey } });
    if (!perm) return;
    const id = `${role.id}-${perm.id}-${params.contextId ?? 'global'}`;
    await db.rolePermission.delete({ where: { id } }).catch(() => {});
    await this.audit.log({
      userId: params.actorId ?? null,
      contextId: params.contextId ?? null,
      action: 'permission.role.revoked',
      success: true,
      metadata: { roleName: params.roleName, permissionKey: params.permissionKey, source: params.source, reason: params.reason },
    });
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


