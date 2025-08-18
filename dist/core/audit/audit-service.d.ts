export interface AuditConfig {
    enabled: boolean;
    sampleRate?: number;
    redactKeys?: string[];
    sinks?: Array<'db' | 'stdout'>;
}
export declare class AuditService {
    private readonly cfg;
    constructor(enabledOrConfig?: boolean | AuditConfig);
    private shouldLog;
    private redact;
    log(params: {
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
    }): Promise<void>;
    logPermissionCheck(userId: string | null, contextId: string | null, requiredPermission: string, success: boolean): Promise<void>;
    logContextResolved(userId: string | null, contextId: string | null, source: 'route' | 'header' | 'query' | 'none'): Promise<void>;
    logTokenIssued(userId: string, tokenType: 'access' | 'refresh'): Promise<void>;
    logTokenRevoked(userId: string, tokenType: 'access' | 'refresh'): Promise<void>;
}
