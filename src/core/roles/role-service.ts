import { getDbClient } from '../db/db-client';
import { AuditService } from '../audit/audit-service';
import { randomUUID } from 'crypto';

export class RoleService {
  private readonly audit = new AuditService();

  async createRole(name: string, options?: { actorId?: string | null; source?: string; reason?: string; key?: string }) {
    const db = getDbClient();
    const role = await db.role.create({ data: { name, key: options?.key ?? randomUUID() } });
    await this.audit.log({
      actorId: options?.actorId ?? null,
      contextId: null,
      action: 'role.created',
      success: true,
      metadata: { roleName: name, source: options?.source, reason: options?.reason },
    });
    return role;
  }

  async deleteRole(nameOrKey: string, options?: { actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = await db.role.findFirst({ where: { OR: [{ name: nameOrKey }, { key: nameOrKey }] } });
    if (!role) return;
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId: role.id } }),
      db.userRole.deleteMany({ where: { roleId: role.id } }),
      db.role.delete({ where: { id: role.id } }),
    ]);
    await this.audit.log({
      actorId: options?.actorId ?? null,
      contextId: null,
      action: 'role.deleted',
      success: true,
      metadata: { roleName: role.name, source: options?.source, reason: options?.reason },
    });
  }

  async listRoles() {
    const db = getDbClient();
    return db.role.findMany({ orderBy: { name: 'asc' } });
  }

  async assignRoleToUser(params: { roleName?: string; roleKey?: string; userId: string; contextId?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = params.roleKey
      ? await db.role.findUnique({ where: { key: params.roleKey } })
      : await db.role.findFirst({ where: { name: params.roleName ?? '' } });
    const ensuredRole = role ?? (await db.role.create({ data: { name: params.roleName ?? params.roleKey ?? 'role', key: randomUUID() } }));
    const id = `${params.userId}-${ensuredRole.id}-${params.contextId ?? 'global'}`;
    const res = await db.userRole.upsert({
      where: { id },
      update: {},
      create: { id, userId: params.userId, roleId: ensuredRole.id, contextId: params.contextId ?? null },
    });
    await this.audit.log({
      actorId: params.actorId ?? null,
      targetUserId: params.userId,
      contextId: params.contextId ?? null,
      action: 'role.assigned',
      success: true,
      metadata: { roleName: ensuredRole.name, roleKey: ensuredRole.key, source: params.source, reason: params.reason },
    });
    return res;
  }

  async removeRoleFromUser(params: { roleName?: string; roleKey?: string; userId: string; contextId?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = params.roleKey
      ? await db.role.findUnique({ where: { key: params.roleKey } })
      : await db.role.findFirst({ where: { name: params.roleName ?? '' } });
    if (!role) return;
    const id = `${params.userId}-${role.id}-${params.contextId ?? 'global'}`;
    await db.userRole.delete({ where: { id } }).catch(() => {});
    await this.audit.log({
      actorId: params.actorId ?? null,
      targetUserId: params.userId,
      contextId: params.contextId ?? null,
      action: 'role.removed',
      success: true,
      metadata: { roleName: role.name, roleKey: role.key, source: params.source, reason: params.reason },
    });
  }

  async addPermissionToRole(params: { roleName?: string; roleKey?: string; permissionKey: string; contextId?: string | null; contextType?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = params.roleKey
      ? await db.role.findUnique({ where: { key: params.roleKey } })
      : await db.role.findFirst({ where: { name: params.roleName ?? '' } });
    const ensuredRole = role ?? (await db.role.create({ data: { name: params.roleName ?? params.roleKey ?? 'role', key: randomUUID() } }));
    const perm = await db.permission.upsert({ where: { key: params.permissionKey }, update: {}, create: { key: params.permissionKey, label: params.permissionKey } });
    const id = `${ensuredRole.id}-${perm.id}-${params.contextId ?? 'global'}`;
    const res = await db.rolePermission.upsert({
      where: { id },
      update: {},
      create: { id, roleId: ensuredRole.id, permissionId: perm.id, contextId: params.contextId ?? null, contextType: params.contextId ? null : (params.contextType ?? null) },
    });
    await this.audit.log({
      actorId: params.actorId ?? null,
      contextId: params.contextId ?? null,
      action: 'permission.role.granted',
      success: true,
      metadata: { roleName: ensuredRole.name, roleKey: ensuredRole.key, permissionKey: params.permissionKey, contextType: params.contextType ?? null, source: params.source, reason: params.reason },
    });
    return res;
  }

  async removePermissionFromRole(params: { roleName?: string; roleKey?: string; permissionKey: string; contextId?: string | null; contextType?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const role = params.roleKey
      ? await db.role.findUnique({ where: { key: params.roleKey } })
      : await db.role.findFirst({ where: { name: params.roleName ?? '' } });
    if (!role) return;
    const perm = await db.permission.findUnique({ where: { key: params.permissionKey } });
    if (!perm) return;
    const id = `${role.id}-${perm.id}-${params.contextId ?? 'global'}`;
    if (params.contextId) {
      await db.rolePermission.delete({ where: { id } }).catch(() => {});
    } else if (params.contextType) {
      await db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: perm.id, contextId: null, contextType: params.contextType } });
    } else {
      await db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: perm.id, contextId: null, contextType: null } });
    }
    await this.audit.log({
      actorId: params.actorId ?? null,
      contextId: params.contextId ?? null,
      action: 'permission.role.revoked',
      success: true,
      metadata: { roleName: role.name, roleKey: role.key, permissionKey: params.permissionKey, contextType: params.contextType ?? null, source: params.source, reason: params.reason },
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


