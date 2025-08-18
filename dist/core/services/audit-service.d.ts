import { type AuditServiceInterface } from './base-service';
export interface AuditConfig {
    enabled: boolean;
    sampleRate?: number;
    redactKeys?: string[];
    sinks?: Array<'db' | 'stdout'>;
    maxMetadataSize?: number;
    batchSize?: number;
    flushInterval?: number;
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
export declare class AuditService implements AuditServiceInterface {
    private readonly cfg;
    private readonly batchQueue;
    private flushTimer?;
    private readonly db;
    constructor(enabledOrConfig?: boolean | AuditConfig);
    private shouldLog;
    private validateAuditEntry;
    private redact;
    private formatLogMessage;
    log(params: AuditLogEntry): Promise<void>;
    private logToSinks;
    private flushBatch;
    logPermissionCheck(userId: string | null, contextId: string | null, requiredPermission: string, success: boolean, metadata?: Record<string, unknown>): Promise<void>;
    logContextResolved(userId: string | null, contextId: string | null, source: 'route' | 'header' | 'query' | 'none', metadata?: Record<string, unknown>): Promise<void>;
    logTokenIssued(userId: string, tokenType: 'access' | 'refresh', metadata?: Record<string, unknown>): Promise<void>;
    logTokenRevoked(userId: string, tokenType: 'access' | 'refresh', metadata?: Record<string, unknown>): Promise<void>;
    logUserAction(actorId: string | null, targetUserId: string | null, action: string, success: boolean, metadata?: Record<string, unknown>): Promise<void>;
    logRoleAction(actorId: string | null, action: string, success: boolean, metadata?: Record<string, unknown>): Promise<void>;
    shutdown(): Promise<void>;
    getAuditLogs(params: {
        actorId?: string;
        targetUserId?: string;
        contextId?: string;
        action?: string;
        success?: boolean;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: any[];
        total: number;
    }>;
}
