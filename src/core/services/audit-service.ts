import { db } from '../db/db-client';
import { ServiceError, type AuditServiceInterface } from './base-service';

export interface AuditConfig {
  enabled: boolean;
  sampleRate?: number; // 0..1
  redactKeys?: string[];
  sinks?: Array<'db' | 'stdout'>;
  maxMetadataSize?: number; // in bytes
  batchSize?: number; // for batch logging
  flushInterval?: number; // in milliseconds
}

export interface AuditLogEntry {
  actorId?: string | null;
  targetUserId?: string | null;
  contextId?: string | null;
  action: string;
  success: boolean;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  plugin?: string | null;
  error?: string | null;
  metadata?: unknown;
}

export class AuditService implements AuditServiceInterface {
  private readonly cfg: AuditConfig;
  private readonly batchQueue: AuditLogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private readonly db = db;

  constructor(enabledOrConfig: boolean | AuditConfig = true) {
    this.cfg = typeof enabledOrConfig === 'boolean' 
      ? { enabled: enabledOrConfig } 
      : enabledOrConfig;
    
    // Set defaults
    if (this.cfg.sinks == null) this.cfg.sinks = ['db'];
    if (this.cfg.maxMetadataSize == null) this.cfg.maxMetadataSize = 1024 * 1024; // 1MB
    if (this.cfg.batchSize == null) this.cfg.batchSize = 100;
    if (this.cfg.flushInterval == null) this.cfg.flushInterval = 5000; // 5 seconds

    // Setup batch flushing
    if (this.cfg.batchSize > 1) {
      this.flushTimer = setInterval(() => {
        this.flushBatch().catch(console.error);
      }, this.cfg.flushInterval);
    }
  }

  private shouldLog(): boolean {
    if (!this.cfg.enabled) return false;
    if (this.cfg.sampleRate == null) return true;
    return Math.random() < this.cfg.sampleRate;
  }

  private validateAuditEntry(entry: AuditLogEntry): void {
    if (!entry.action || typeof entry.action !== 'string') {
      throw ServiceError.validationError('Audit action is required and must be a string');
    }

    if (entry.action.length > 255) {
      throw ServiceError.validationError('Audit action must be 255 characters or less');
    }

    if (entry.metadata && typeof entry.metadata === 'object') {
      const metadataSize = JSON.stringify(entry.metadata).length;
      if (metadataSize > this.cfg.maxMetadataSize!) {
        throw ServiceError.validationError(`Audit metadata size (${metadataSize} bytes) exceeds maximum allowed size (${this.cfg.maxMetadataSize} bytes)`);
      }
    }
  }

  private redact(value: unknown): unknown {
    if (!value || !this.cfg.redactKeys?.length || typeof value !== 'object') {
      return value;
    }

    try {
      const clone = JSON.parse(JSON.stringify(value));
      for (const key of this.cfg.redactKeys) {
        if (key in clone) {
          clone[key] = '[REDACTED]';
        }
      }
      return clone;
    } catch {
      return value;
    }
  }

  private formatLogMessage(entry: AuditLogEntry): string {
    const timestamp = new Date().toISOString();
    const status = entry.success ? 'SUCCESS' : 'FAILURE';
    const actor = entry.actorId ? `actor=${entry.actorId}` : 'actor=system';
    const target = entry.targetUserId ? `target=${entry.targetUserId}` : '';
    const context = entry.contextId ? `context=${entry.contextId}` : '';
    const error = entry.error ? `error="${entry.error}"` : '';

    return [
      `[AUDIT ${timestamp}]`,
      status,
      entry.action,
      actor,
      target,
      context,
      error
    ].filter(Boolean).join(' ');
  }

  async log(params: AuditLogEntry): Promise<void> {
    if (!this.shouldLog()) return;

    try {
      this.validateAuditEntry(params);

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
        metadata: this.redact(params.metadata) as any,
      } as const;

      // Handle batch logging
      if (this.cfg.batchSize! > 1) {
        this.batchQueue.push(data);
        if (this.batchQueue.length >= this.cfg.batchSize!) {
          await this.flushBatch();
        }
        return;
      }

      // Immediate logging
      await this.logToSinks(data);
    } catch (error) {
      // Don't let audit logging errors break the application
      console.error('Audit logging failed:', error);
    }
  }

  private async logToSinks(data: any): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.cfg.sinks?.includes('db')) {
      promises.push(
        this.db.auditLog.create({ data }).then(() => {}).catch(error => {
          console.error('Failed to write audit log to database:', error);
        })
      );
    }

    if (this.cfg.sinks?.includes('stdout')) {
      promises.push(
        Promise.resolve().then(() => {
          console.log(this.formatLogMessage(data));
        })
      );
    }

    await Promise.allSettled(promises);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue.length = 0;

    try {
      if (this.cfg.sinks?.includes('db')) {
        await this.db.auditLog.createMany({
          data: batch.map(entry => ({
            ...entry,
            metadata: entry.metadata as any
          }))
        });
      }

      if (this.cfg.sinks?.includes('stdout')) {
        for (const entry of batch) {
          console.log(this.formatLogMessage(entry));
        }
      }
    } catch (error) {
      console.error('Failed to flush audit batch:', error);
      // Re-queue failed entries for retry
      this.batchQueue.unshift(...batch);
    }
  }

  // Convenience methods for common audit events
  async logPermissionCheck(
    userId: string | null, 
    contextId: string | null, 
    requiredPermission: string, 
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      actorId: userId,
      contextId,
      action: 'permission.check',
      success,
      metadata: { requiredPermission, ...metadata },
    });
  }

  async logContextResolved(
    userId: string | null, 
    contextId: string | null, 
    source: 'route' | 'header' | 'query' | 'none',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      actorId: userId,
      contextId,
      action: 'context.resolve',
      success: Boolean(contextId),
      metadata: { source, ...metadata },
    });
  }

  async logTokenIssued(
    userId: string, 
    tokenType: 'access' | 'refresh',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({ 
      actorId: userId, 
      contextId: null, 
      action: 'token.issued', 
      success: true, 
      metadata: { tokenType, ...metadata } 
    });
  }

  async logTokenRevoked(
    userId: string, 
    tokenType: 'access' | 'refresh',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({ 
      actorId: userId, 
      contextId: null, 
      action: 'token.revoked', 
      success: true, 
      metadata: { tokenType, ...metadata } 
    });
  }

  async logUserAction(
    actorId: string | null,
    targetUserId: string | null,
    action: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      actorId,
      targetUserId,
      action,
      success,
      metadata,
    });
  }

  async logRoleAction(
    actorId: string | null,
    action: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      actorId,
      action,
      success,
      metadata,
    });
  }

  // Cleanup method for graceful shutdown
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Flush any remaining batched logs
    await this.flushBatch();
  }

  // Query methods for audit analysis
  async getAuditLogs(params: {
    actorId?: string;
    targetUserId?: string;
    contextId?: string;
    action?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const where: any = {};

    if (params.actorId) where.actorId = params.actorId;
    if (params.targetUserId) where.targetUserId = params.targetUserId;
    if (params.contextId) where.contextId = params.contextId;
    if (params.action) where.action = params.action;
    if (params.success !== undefined) where.success = params.success;
    
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 100,
        skip: params.offset ?? 0,
      }),
      this.db.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}


