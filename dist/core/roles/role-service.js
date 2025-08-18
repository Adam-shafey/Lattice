"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleService = void 0;
const db_client_1 = require("../db/db-client");
const audit_service_1 = require("../audit/audit-service");
const crypto_1 = require("crypto");
class RoleService {
    constructor() {
        this.audit = new audit_service_1.AuditService();
    }
    async createRole(name, options) {
        const role = await db_client_1.db.role.create({ data: { name, key: options?.key ?? (0, crypto_1.randomUUID)() } });
        await this.audit.log({
            actorId: options?.actorId ?? null,
            contextId: null,
            action: 'role.created',
            success: true,
            metadata: { roleName: name, source: options?.source, reason: options?.reason },
        });
        return role;
    }
    async deleteRole(nameOrKey, options) {
        const role = await db_client_1.db.role.findFirst({ where: { OR: [{ name: nameOrKey }, { key: nameOrKey }] } });
        if (!role)
            return;
        await db_client_1.db.$transaction(async (tx) => {
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
        return db_client_1.db.role.findMany({ orderBy: { name: 'asc' } });
    }
    async assignRoleToUser(params) {
        const role = params.roleKey
            ? await db_client_1.db.role.findUnique({ where: { key: params.roleKey } })
            : await db_client_1.db.role.findFirst({ where: { name: params.roleName ?? '' } });
        const ensuredRole = role ?? (await db_client_1.db.role.create({ data: { name: params.roleName ?? params.roleKey ?? 'role', key: (0, crypto_1.randomUUID)() } }));
        // Validate context exists and type matches
        if (params.contextId) {
            const context = await db_client_1.db.context.findUnique({ where: { id: params.contextId } });
            if (!context) {
                throw new Error(`Context ${params.contextId} not found`);
            }
            if (params.contextType && context.type !== params.contextType) {
                throw new Error(`Context ${params.contextId} has type ${context.type}, expected ${params.contextType}`);
            }
        }
        const id = `${params.userId}-${ensuredRole.id}-${params.contextId ?? 'global'}`;
        const res = await db_client_1.db.userRole.upsert({
            where: { id },
            update: {},
            create: {
                id,
                userId: params.userId,
                roleId: ensuredRole.id,
                contextId: params.contextId ?? null,
                contextType: params.contextType ?? null
            },
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
    async removeRoleFromUser(params) {
        const role = params.roleKey
            ? await db_client_1.db.role.findUnique({ where: { key: params.roleKey } })
            : await db_client_1.db.role.findFirst({ where: { name: params.roleName ?? '' } });
        if (!role)
            return;
        const id = `${params.userId}-${role.id}-${params.contextId ?? 'global'}`;
        await db_client_1.db.userRole.delete({ where: { id } }).catch(() => { });
        await this.audit.log({
            actorId: params.actorId ?? null,
            targetUserId: params.userId,
            contextId: params.contextId ?? null,
            action: 'role.removed',
            success: true,
            metadata: { roleName: role.name, roleKey: role.key, source: params.source, reason: params.reason },
        });
    }
    async addPermissionToRole(params) {
        const role = params.roleKey
            ? await db_client_1.db.role.findUnique({ where: { key: params.roleKey } })
            : await db_client_1.db.role.findFirst({ where: { name: params.roleName ?? '' } });
        const ensuredRole = role ?? (await db_client_1.db.role.create({ data: { name: params.roleName ?? params.roleKey ?? 'role', key: (0, crypto_1.randomUUID)() } }));
        const perm = await db_client_1.db.permission.upsert({ where: { key: params.permissionKey }, update: {}, create: { key: params.permissionKey, label: params.permissionKey } });
        const id = `${ensuredRole.id}-${perm.id}-${params.contextId ?? 'global'}`;
        const res = await db_client_1.db.rolePermission.upsert({
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
    async removePermissionFromRole(params) {
        const role = params.roleKey
            ? await db_client_1.db.role.findUnique({ where: { key: params.roleKey } })
            : await db_client_1.db.role.findFirst({ where: { name: params.roleName ?? '' } });
        if (!role)
            return;
        const perm = await db_client_1.db.permission.findUnique({ where: { key: params.permissionKey } });
        if (!perm)
            return;
        const id = `${role.id}-${perm.id}-${params.contextId ?? 'global'}`;
        if (params.contextId) {
            await db_client_1.db.rolePermission.delete({ where: { id } }).catch(() => { });
        }
        else if (params.contextType) {
            await db_client_1.db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: perm.id, contextId: null, contextType: params.contextType } });
        }
        else {
            await db_client_1.db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: perm.id, contextId: null, contextType: null } });
        }
        await this.audit.log({
            actorId: params.actorId ?? null,
            contextId: params.contextId ?? null,
            action: 'permission.role.revoked',
            success: true,
            metadata: { roleName: role.name, roleKey: role.key, permissionKey: params.permissionKey, contextType: params.contextType ?? null, source: params.source, reason: params.reason },
        });
    }
    async listUserRoles(params) {
        const roles = await db_client_1.db.userRole.findMany({
            where: {
                userId: params.userId,
                OR: [
                    { contextId: null },
                    ...(params.contextId ? [{ contextId: params.contextId }] : []),
                ],
            },
            include: { role: true },
        });
        return roles.map((r) => ({ name: r.role.name, contextId: r.contextId }));
    }
}
exports.RoleService = RoleService;
