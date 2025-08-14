import { db, type Prisma } from '../db/db-client';
import { AuditService } from './audit-service';
import { randomUUID } from 'crypto';
import { type RoutePermissionPolicy } from '../policy/policy';
import { CoreSaaS } from '../../index';

export class RoleService {
  private audit = new AuditService();
  private app: ReturnType<typeof CoreSaaS>;

  constructor(app: ReturnType<typeof CoreSaaS>) {
    this.app = app;
  }

  async createRole(name: string, options?: { 
    actorId?: string | null; 
    source?: string; 
    reason?: string; 
    key?: string;
    contextType: string;
  }) {
    const role = await db.role.create({
      data: {
        name,
        key: options?.key ?? randomUUID(),
        contextType: options?.contextType ?? 'global'
      }
    });
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
    const role = await db.role.findFirst({ where: { OR: [{ name: nameOrKey }, { key: nameOrKey }] } });
    if (!role) return;
    await db.$transaction(async (tx: any) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.userRole.deleteMany({ where: { roleId: role.id } });
      await tx.role.delete({ where: { id: role.id } });
    });
    await this.audit.log({
      actorId: options?.actorId ?? null,
      contextId: null,
      action: 'role.deleted',
      success: true,
      metadata: { roleName: role.name, source: options?.source, reason: options?.reason },
    });
  }

  async listRoles() {
    return db.role.findMany({ orderBy: { name: 'asc' } });
  }

  async assignRoleToUser(params: { roleName?: string; roleKey?: string; userId: string; contextId?: string | null; contextType?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    // Find the role
    const role = params.roleKey
      ? await db.role.findUnique({ where: { key: params.roleKey } })
      : await db.role.findFirst({ where: { name: params.roleName ?? '' } });
    if (!role) throw new Error('Role not found');

    // Validate context type matches
    if (params.contextId) {
      const context = await db.context.findUnique({ where: { id: params.contextId } });
      if (!context) throw new Error(`Context ${params.contextId} not found`);
      if (context.type !== role.contextType) {
        throw new Error(`Role ${role.name} has type ${role.contextType}, cannot be assigned in ${context.type} context`);
      }
    }
    // Create the user-role link
    const id = `${role.id}-${params.userId}-${params.contextId ?? 'global'}`;
    const res = await db.userRole.upsert({
      where: { id },
      update: {},
      create: {
        id,
        userId: params.userId,
        roleId: role.id,
        contextId: params.contextId ?? null,
        contextType: params.contextId ? null : (params.contextType ?? null)
      }
    });

    await this.audit.log({
      actorId: params.actorId ?? null,
      targetUserId: params.userId,
      contextId: params.contextId ?? null,
      action: 'role.user.assigned',
      success: true,
      metadata: { roleName: role.name, roleKey: role.key, source: params.source, reason: params.reason },
    });

    return res;
  }


  async removeRoleFromUser(params: { roleName?: string; roleKey?: string; userId: string; contextId?: string | null; contextType?: string | null; actorId?: string | null; source?: string; reason?: string }) {
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

  async addPermissionToRole(params: { 
    roleName?: string; 
    roleKey?: string; 
    permissionKey: string; 
    contextId?: string | null; 
    contextType?: string | null; 
    actorId?: string | null; 
    source?: string; 
    reason?: string;
    policy: RoutePermissionPolicy;
  }) {
    // First find the role to get its context type
    const role = params.roleKey
      ? await db.role.findUnique({ where: { key: params.roleKey } })
      : await db.role.findFirst({ where: { name: params.roleName ?? '' } });
    if (!role) throw new Error('Role not found');

    // Check role management permission
    const canManageRoles = await this.app.checkAccess({
      userId: params.actorId!,
      permission: params.policy.roles!.addPerm.roleManage.replace('{type}', role.contextType),
      scope: 'type-wide',
      contextType: role.contextType
    });
    if (!canManageRoles) {
      throw new Error(`No permission to manage ${role.contextType} roles`);
    }

    // Check permission grant ability
    const canGrantPermission = await this.app.checkAccess({
      userId: params.actorId!,
      permission: params.policy.roles!.addPerm.permissionGrant
        .replace('{perm}', params.permissionKey)
        .replace('{type}', role.contextType),
      scope: 'type-wide',
      contextType: role.contextType
    });
    if (!canGrantPermission) {
      throw new Error(`No permission to grant ${params.permissionKey} in ${role.contextType}`);
    }
    // Create or find the permission
    const perm = await db.permission.upsert({ 
      where: { key: params.permissionKey }, 
      update: {}, 
      create: { key: params.permissionKey, label: params.permissionKey } 
    });

    // Create the role-permission link
    const id = `${role.id}-${perm.id}-${params.contextId ?? 'global'}`;
    const res = await db.rolePermission.upsert({
      where: { id },
      update: {},
      create: { id, roleId: role.id, permissionId: perm.id, contextId: params.contextId ?? null, contextType: params.contextId ? null : (params.contextType ?? null) },
    });
    await this.audit.log({
      actorId: params.actorId ?? null,
      contextId: params.contextId ?? null,
      action: 'permission.role.granted',
      success: true,
      metadata: { roleName: role.name, roleKey: role.key, permissionKey: params.permissionKey, contextType: params.contextType ?? null, source: params.source, reason: params.reason },
    });
    return res;
  }

  async removePermissionFromRole(params: { roleName?: string; roleKey?: string; permissionKey: string; contextId?: string | null; contextType?: string | null; actorId?: string | null; source?: string; reason?: string }) {
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
    const roles = await db.userRole.findMany({
      where: {
        userId: params.userId,
        OR: [
          { contextId: null },
          ...(params.contextId ? [{ contextId: params.contextId }] : []),
        ],
      },
      include: { role: true },
    });
    return roles.map((r: { role: { name: string }; contextId: string | null }) => ({ name: r.role.name, contextId: r.contextId }));
  }
}


