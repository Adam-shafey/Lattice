"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const db_client_1 = require("../db/db-client");
class AuditService {
    constructor(enabledOrConfig = true) {
        this.cfg = typeof enabledOrConfig === 'boolean' ? { enabled: enabledOrConfig } : enabledOrConfig;
        if (this.cfg.sinks == null)
            this.cfg.sinks = ['db'];
    }
    shouldLog() {
        if (!this.cfg.enabled)
            return false;
        if (this.cfg.sampleRate == null)
            return true;
        return Math.random() < this.cfg.sampleRate;
    }
    redact(value) {
        if (!value || !this.cfg.redactKeys?.length)
            return value;
        try {
            const clone = JSON.parse(JSON.stringify(value));
            for (const key of this.cfg.redactKeys) {
                if (key in clone)
                    clone[key] = '[REDACTED]';
            }
            return clone;
        }
        catch {
            return value;
        }
    }
    async log(params) {
        if (!this.shouldLog())
            return;
        const db = (0, db_client_1.getDbClient)();
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
            metadata: this.redact(params.metadata) ?? undefined,
        };
        if (this.cfg.sinks?.includes('db')) {
            await db.auditLog.create({ data: data });
        }
        if (this.cfg.sinks?.includes('stdout')) {
            // eslint-disable-next-line no-console
            console.log('[AUDIT]', JSON.stringify({ ...data, createdAt: new Date().toISOString() }));
        }
    }
    async logPermissionCheck(userId, contextId, requiredPermission, success) {
        await this.log({
            actorId: userId,
            contextId,
            action: 'permission.check',
            success,
            metadata: { requiredPermission },
        });
    }
    async logContextResolved(userId, contextId, source) {
        await this.log({
            actorId: userId,
            contextId,
            action: 'context.resolve',
            success: Boolean(contextId),
            metadata: { source },
        });
    }
    async logTokenIssued(userId, tokenType) {
        await this.log({ actorId: userId, contextId: null, action: 'token.issued', success: true, metadata: { tokenType } });
    }
    async logTokenRevoked(userId, tokenType) {
        await this.log({ actorId: userId, contextId: null, action: 'token.revoked', success: true, metadata: { tokenType } });
    }
}
exports.AuditService = AuditService;
