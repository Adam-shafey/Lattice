import { getDbClient } from '../db/db-client';

export class AuditService {
  async log(params: { userId?: string | null; contextId?: string | null; action: string; success: boolean; metadata?: unknown }) {
    const db = getDbClient();
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        contextId: params.contextId ?? null,
        action: params.action,
        success: params.success,
        metadata: (params.metadata as any) ?? undefined,
      },
    });
  }

  async logPermissionCheck(userId: string | null, contextId: string | null, requiredPermission: string, success: boolean) {
    await this.log({
      userId,
      contextId,
      action: 'permission.check',
      success,
      metadata: { requiredPermission },
    });
  }

  async logContextResolved(userId: string | null, contextId: string | null, source: 'route' | 'header' | 'query' | 'none') {
    await this.log({
      userId,
      contextId,
      action: 'context.resolve',
      success: Boolean(contextId),
      metadata: { source },
    });
  }

  async logTokenIssued(userId: string, tokenType: 'access' | 'refresh') {
    await this.log({ userId, contextId: null, action: 'token.issued', success: true, metadata: { tokenType } });
  }

  async logTokenRevoked(userId: string, tokenType: 'access' | 'refresh') {
    await this.log({ userId, contextId: null, action: 'token.revoked', success: true, metadata: { tokenType } });
  }
}


