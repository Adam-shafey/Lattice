import { getDbClient } from '../db/db-client';
import { AuditService } from '../audit/audit-service';

export class UserPermissionService {
  private readonly audit = new AuditService();

  async grantToUser(params: { userId: string; permissionKey: string; contextId?: string | null; contextType?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const perm = await db.permission.upsert({ where: { key: params.permissionKey }, update: {}, create: { key: params.permissionKey, label: params.permissionKey } });
    const id = `${params.userId}-${perm.id}-${params.contextId ?? 'global'}`;
    await db.userPermission.upsert({ where: { id }, update: {}, create: { id, userId: params.userId, permissionId: perm.id, contextId: params.contextId ?? null, contextType: params.contextType ?? null } });
    await this.audit.log({
      actorId: params.actorId ?? null,
      targetUserId: params.userId,
      contextId: params.contextId ?? null,
      action: 'permission.user.granted',
      success: true,
      metadata: { permissionKey: params.permissionKey, contextType: params.contextType ?? null, source: params.source, reason: params.reason },
    });
  }

  async revokeFromUser(params: { userId: string; permissionKey: string; contextId?: string | null; contextType?: string | null; actorId?: string | null; source?: string; reason?: string }) {
    const db = getDbClient();
    const perm = await db.permission.findUnique({ where: { key: params.permissionKey } });
    if (!perm) return;
    const id = `${params.userId}-${perm.id}-${params.contextId ?? 'global'}`;
    await db.userPermission.delete({ where: { id } }).catch(async () => {
      // try type-wide form if exact not found
      if (!params.contextId && params.contextType) {
        await db.userPermission.deleteMany({ where: { userId: params.userId, permissionId: perm.id, contextId: null, contextType: params.contextType } });
      }
    });
    await this.audit.log({
      actorId: params.actorId ?? null,
      targetUserId: params.userId,
      contextId: params.contextId ?? null,
      action: 'permission.user.revoked',
      success: true,
      metadata: { permissionKey: params.permissionKey, contextType: params.contextType ?? null, source: params.source, reason: params.reason },
    });
  }
}


