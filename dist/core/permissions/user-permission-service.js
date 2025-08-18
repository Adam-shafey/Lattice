"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPermissionService = void 0;
const db_client_1 = require("../db/db-client");
const audit_service_1 = require("../audit/audit-service");
class UserPermissionService {
    constructor() {
        this.audit = new audit_service_1.AuditService();
    }
    async grantToUser(params) {
        const db = (0, db_client_1.getDbClient)();
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
    async revokeFromUser(params) {
        const db = (0, db_client_1.getDbClient)();
        const perm = await db.permission.findUnique({ where: { key: params.permissionKey } });
        if (!perm)
            return;
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
exports.UserPermissionService = UserPermissionService;
