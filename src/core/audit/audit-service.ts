import { getDbClient } from '../db/db-client';

export interface AuditConfig {
  enabled: boolean;
  sampleRate?: number; // 0..1
  redactKeys?: string[];
  sinks?: Array<'db' | 'stdout'>;
}

export class AuditService {
  private readonly cfg: AuditConfig;

  constructor(enabledOrConfig: boolean | AuditConfig = true) {
    this.cfg = typeof enabledOrConfig === 'boolean' ? { enabled: enabledOrConfig } : enabledOrConfig;
    if (this.cfg.sinks == null) this.cfg.sinks = ['db'];
  }

  private shouldLog(): boolean {
    if (!this.cfg.enabled) return false;
    if (this.cfg.sampleRate == null) return true;
    return Math.random() < this.cfg.sampleRate;
  }

  private redact(value: any): any {
    if (!value || !this.cfg.redactKeys?.length) return value;
    try {
      const clone = JSON.parse(JSON.stringify(value));
      for (const key of this.cfg.redactKeys) {
        if (key in clone) clone[key] = '[REDACTED]';
      }
      return clone;
    } catch {
      return value;
    }
  }

  async log(params: { actorId?: string | null; targetUserId?: string | null; contextId?: string | null; action: string; success: boolean; requestId?: string | null; ip?: string | null; userAgent?: string | null; resourceType?: string | null; resourceId?: string | null; plugin?: string | null; error?: string | null; metadata?: unknown }) {
    if (!this.shouldLog()) return;
    const db = getDbClient();
    const data = {
      actorId: params.actorId ?? null,
      targetUserId: params.targetUserId ?? null,
      contextId: params.contextId ?? null,
      action: params.action,
      success: params.success,
      requestId: params.requestId ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      plugin: params.plugin ?? null,
      error: params.error ?? null,
      metadata: (this.redact(params.metadata) as any) ?? undefined,
    } as const;
    if (this.cfg.sinks?.includes('db')) {
      await db.auditLog.create({ data: data as any });
    }
    if (this.cfg.sinks?.includes('stdout')) {
      // eslint-disable-next-line no-console
      console.log('[AUDIT]', JSON.stringify({ ...data, createdAt: new Date().toISOString() }));
    }
  }

  async logPermissionCheck(userId: string | null, contextId: string | null, requiredPermission: string, success: boolean) {
    await this.log({
      actorId: userId,
      contextId,
      action: 'permission.check',
      success,
      metadata: { requiredPermission },
    });
  }

  async logContextResolved(userId: string | null, contextId: string | null, source: 'route' | 'header' | 'query' | 'none') {
    await this.log({
      actorId: userId,
      contextId,
      action: 'context.resolve',
      success: Boolean(contextId),
      metadata: { source },
    });
  }

  async logTokenIssued(userId: string, tokenType: 'access' | 'refresh') {
    await this.log({ actorId: userId, contextId: null, action: 'token.issued', success: true, metadata: { tokenType } });
  }

  async logTokenRevoked(userId: string, tokenType: 'access' | 'refresh') {
    await this.log({ actorId: userId, contextId: null, action: 'token.revoked', success: true, metadata: { tokenType } });
  }
}


