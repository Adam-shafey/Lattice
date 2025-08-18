"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleService = void 0;
const base_service_1 = require("./base-service");
const crypto_1 = require("crypto");
class RoleService extends base_service_1.BaseService {
    constructor(db) {
        super(db);
    }
    async createRole(params) {
        const { name, contextType, key, context: serviceContext } = params;
        // Validate inputs
        this.validateString(name, 'role name');
        this.validateString(contextType, 'context type');
        return this.execute(async () => {
            // Check if role with same name already exists
            const existing = await this.db.role.findFirst({
                where: { name, contextType }
            });
            if (existing) {
                throw base_service_1.ServiceError.conflict(`Role '${name}' already exists for context type '${contextType}'`);
            }
            const role = await this.db.role.create({
                data: {
                    name,
                    key: key ?? (0, crypto_1.randomUUID)(),
                    contextType,
                },
            });
            return role;
        }, {
            action: 'role.created',
            success: true,
            resourceType: 'role',
            resourceId: name,
            metadata: { name, contextType, key },
        }, serviceContext);
    }
    async getRoleByName(name, context) {
        this.validateString(name, 'role name');
        return this.execute(async () => {
            return this.db.role.findFirst({ where: { name } });
        }, {
            action: 'role.read',
            success: true,
            resourceType: 'role',
            resourceId: name,
        }, context);
    }
    async getRoleByKey(key, context) {
        this.validateString(key, 'role key');
        return this.execute(async () => {
            return this.db.role.findUnique({ where: { key } });
        }, {
            action: 'role.read',
            success: true,
            resourceType: 'role',
            resourceId: key,
        }, context);
    }
    async deleteRole(nameOrKey, context) {
        this.validateString(nameOrKey, 'role name or key');
        return this.execute(async () => {
            const role = await this.db.role.findFirst({
                where: { OR: [{ name: nameOrKey }, { key: nameOrKey }] }
            });
            if (!role) {
                throw base_service_1.ServiceError.notFound('Role', nameOrKey);
            }
            // Use transaction to ensure all related data is deleted
            await this.withTransaction(async (tx) => {
                await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
                await tx.userRole.deleteMany({ where: { roleId: role.id } });
                await tx.role.delete({ where: { id: role.id } });
            });
        }, {
            action: 'role.deleted',
            success: true,
            resourceType: 'role',
            resourceId: nameOrKey,
        }, context);
    }
    async listRoles(params) {
        const { contextType, context: serviceContext } = params ?? {};
        if (contextType) {
            this.validateString(contextType, 'context type');
        }
        return this.execute(async () => {
            const where = contextType ? { contextType } : {};
            return this.db.role.findMany({
                where,
                orderBy: { name: 'asc' }
            });
        }, {
            action: 'role.list',
            success: true,
            metadata: { contextType },
        }, serviceContext);
    }
    async assignRoleToUser(params) {
        const { roleName, roleKey, userId, contextId, contextType, context: serviceContext } = params;
        // Validate inputs
        this.validateString(userId, 'user id');
        if (!roleName && !roleKey) {
            throw base_service_1.ServiceError.validationError('Either roleName or roleKey must be provided');
        }
        return this.execute(async () => {
            // Find the role
            const role = roleKey
                ? await this.db.role.findUnique({ where: { key: roleKey } })
                : await this.db.role.findFirst({ where: { name: roleName } });
            if (!role) {
                throw base_service_1.ServiceError.notFound('Role', roleName || roleKey || '');
            }
            // Verify user exists
            const user = await this.db.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw base_service_1.ServiceError.notFound('User', userId);
            }
            // Validate context type matches if contextId is provided
            if (contextId) {
                const context = await this.db.context.findUnique({ where: { id: contextId } });
                if (!context) {
                    throw base_service_1.ServiceError.notFound('Context', contextId);
                }
                if (context.type !== role.contextType) {
                    throw base_service_1.ServiceError.validationError(`Role '${role.name}' has type '${role.contextType}', cannot be assigned in '${context.type}' context`);
                }
            }
            // Create the user-role link
            const id = `${role.id}-${userId}-${contextId ?? 'global'}`;
            const userRole = await this.db.userRole.upsert({
                where: { id },
                update: {},
                create: {
                    id,
                    userId,
                    roleId: role.id,
                    contextId: contextId ?? null,
                    contextType: contextId ? null : (contextType ?? null),
                },
            });
            return userRole;
        }, {
            action: 'role.user.assigned',
            success: true,
            targetUserId: userId,
            contextId,
            resourceType: 'role',
            resourceId: roleName || roleKey || '',
            metadata: { roleName, roleKey, contextType },
        }, serviceContext);
    }
    async removeRoleFromUser(params) {
        const { roleName, roleKey, userId, contextId, contextType, context: serviceContext } = params;
        // Validate inputs
        this.validateString(userId, 'user id');
        if (!roleName && !roleKey) {
            throw base_service_1.ServiceError.validationError('Either roleName or roleKey must be provided');
        }
        return this.execute(async () => {
            const role = roleKey
                ? await this.db.role.findUnique({ where: { key: roleKey } })
                : await this.db.role.findFirst({ where: { name: roleName } });
            if (!role) {
                // Role doesn't exist, so there's nothing to remove
                return;
            }
            const id = `${role.id}-${userId}-${contextId ?? 'global'}`;
            await this.db.userRole.delete({ where: { id } }).catch(() => {
                // User-role assignment doesn't exist, which is fine
            });
        }, {
            action: 'role.user.removed',
            success: true,
            targetUserId: userId,
            contextId,
            resourceType: 'role',
            resourceId: roleName || roleKey || '',
            metadata: { roleName, roleKey, contextType },
        }, serviceContext);
    }
    async addPermissionToRole(params) {
        const { roleName, roleKey, permissionKey, contextId, contextType, context: serviceContext } = params;
        // Validate inputs
        this.validateString(permissionKey, 'permission key');
        if (!roleName && !roleKey) {
            throw base_service_1.ServiceError.validationError('Either roleName or roleKey must be provided');
        }
        return this.execute(async () => {
            // Find the role
            const role = roleKey
                ? await this.db.role.findUnique({ where: { key: roleKey } })
                : await this.db.role.findFirst({ where: { name: roleName } });
            if (!role) {
                throw base_service_1.ServiceError.notFound('Role', roleName || roleKey || '');
            }
            // Verify context exists if provided
            if (contextId) {
                const context = await this.db.context.findUnique({ where: { id: contextId } });
                if (!context) {
                    throw base_service_1.ServiceError.notFound('Context', contextId);
                }
            }
            // Create or find the permission
            const permission = await this.db.permission.upsert({
                where: { key: permissionKey },
                update: {},
                create: { key: permissionKey, label: permissionKey },
            });
            // Create the role-permission link
            const id = `${role.id}-${permission.id}-${contextId ?? 'global'}`;
            const rolePermission = await this.db.rolePermission.upsert({
                where: { id },
                update: {},
                create: {
                    id,
                    roleId: role.id,
                    permissionId: permission.id,
                    contextId: contextId ?? null,
                    contextType: contextId ? null : (contextType ?? null),
                },
            });
            return rolePermission;
        }, {
            action: 'permission.role.granted',
            success: true,
            contextId,
            resourceType: 'role',
            resourceId: roleName || roleKey || '',
            metadata: { roleName, roleKey, permissionKey, contextType },
        }, serviceContext);
    }
    async removePermissionFromRole(params) {
        const { roleName, roleKey, permissionKey, contextId, contextType, context: serviceContext } = params;
        // Validate inputs
        this.validateString(permissionKey, 'permission key');
        if (!roleName && !roleKey) {
            throw base_service_1.ServiceError.validationError('Either roleName or roleKey must be provided');
        }
        return this.execute(async () => {
            const role = roleKey
                ? await this.db.role.findUnique({ where: { key: roleKey } })
                : await this.db.role.findFirst({ where: { name: roleName } });
            if (!role) {
                // Role doesn't exist, so there's nothing to remove
                return;
            }
            const permission = await this.db.permission.findUnique({ where: { key: permissionKey } });
            if (!permission) {
                // Permission doesn't exist, so there's nothing to remove
                return;
            }
            const id = `${role.id}-${permission.id}-${contextId ?? 'global'}`;
            try {
                await this.db.rolePermission.delete({ where: { id } });
            }
            catch {
                // If exact match not found, try type-wide form
                if (!contextId && contextType) {
                    await this.db.rolePermission.deleteMany({
                        where: {
                            roleId: role.id,
                            permissionId: permission.id,
                            contextId: null,
                            contextType,
                        },
                    });
                }
            }
        }, {
            action: 'permission.role.revoked',
            success: true,
            contextId,
            resourceType: 'role',
            resourceId: roleName || roleKey || '',
            metadata: { roleName, roleKey, permissionKey, contextType },
        }, serviceContext);
    }
    async listUserRoles(params) {
        const { userId, contextId, context: serviceContext } = params;
        // Validate inputs
        this.validateString(userId, 'user id');
        return this.execute(async () => {
            // Verify user exists
            const user = await this.db.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw base_service_1.ServiceError.notFound('User', userId);
            }
            const userRoles = await this.db.userRole.findMany({
                where: {
                    userId,
                    OR: [
                        { contextId: null },
                        ...(contextId ? [{ contextId }] : []),
                    ],
                },
                include: { role: true },
            });
            return userRoles.map((ur) => ({
                name: ur.role.name,
                contextId: ur.contextId
            }));
        }, {
            action: 'role.user.list',
            success: true,
            targetUserId: userId,
            contextId,
        }, serviceContext);
    }
    async getRolePermissions(params) {
        const { roleId, contextId, contextType, context: serviceContext } = params;
        // Validate inputs
        this.validateString(roleId, 'role id');
        return this.execute(async () => {
            // Verify role exists
            const role = await this.db.role.findUnique({ where: { id: roleId } });
            if (!role) {
                throw base_service_1.ServiceError.notFound('Role', roleId);
            }
            // Build where clause
            const where = { roleId };
            if (contextId) {
                where.contextId = contextId;
            }
            else if (contextType) {
                where.contextId = null;
                where.contextType = contextType;
            }
            else {
                where.contextId = null;
                where.contextType = null;
            }
            const rolePermissions = await this.db.rolePermission.findMany({
                where,
                include: { permission: true },
            });
            return rolePermissions.map((rp) => ({
                key: rp.permission.key,
                label: rp.permission.label,
                contextId: rp.contextId,
            }));
        }, {
            action: 'role.permissions.list',
            success: true,
            resourceType: 'role',
            resourceId: roleId,
            contextId,
            metadata: { contextType },
        }, serviceContext);
    }
    async bulkAssignRolesToUser(params) {
        const { userId, roles, context: serviceContext } = params;
        // Validate inputs
        this.validateString(userId, 'user id');
        if (!Array.isArray(roles) || roles.length === 0) {
            throw base_service_1.ServiceError.validationError('At least one role must be provided');
        }
        return this.execute(async () => {
            // Verify user exists
            const user = await this.db.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw base_service_1.ServiceError.notFound('User', userId);
            }
            const results = [];
            // Use transaction for bulk operations
            await this.withTransaction(async (tx) => {
                for (const roleAssignment of roles) {
                    // Validate role assignment
                    if (!roleAssignment.roleName && !roleAssignment.roleKey) {
                        throw base_service_1.ServiceError.validationError('Either roleName or roleKey must be provided for each role');
                    }
                    // Find the role
                    const role = roleAssignment.roleKey
                        ? await tx.role.findUnique({ where: { key: roleAssignment.roleKey } })
                        : await tx.role.findFirst({ where: { name: roleAssignment.roleName } });
                    if (!role) {
                        throw base_service_1.ServiceError.notFound('Role', roleAssignment.roleName || roleAssignment.roleKey || '');
                    }
                    // Validate context type matches if contextId is provided
                    if (roleAssignment.contextId) {
                        const context = await tx.context.findUnique({ where: { id: roleAssignment.contextId } });
                        if (!context) {
                            throw base_service_1.ServiceError.notFound('Context', roleAssignment.contextId);
                        }
                        if (context.type !== role.contextType) {
                            throw base_service_1.ServiceError.validationError(`Role '${role.name}' has type '${role.contextType}', cannot be assigned in '${context.type}' context`);
                        }
                    }
                    // Create the user-role link
                    const id = `${role.id}-${userId}-${roleAssignment.contextId ?? 'global'}`;
                    const userRole = await tx.userRole.upsert({
                        where: { id },
                        update: {},
                        create: {
                            id,
                            userId,
                            roleId: role.id,
                            contextId: roleAssignment.contextId ?? null,
                            contextType: roleAssignment.contextId ? null : (roleAssignment.contextType ?? null),
                        },
                    });
                    results.push(userRole);
                }
            });
            return results;
        }, {
            action: 'role.user.bulk.assigned',
            success: true,
            targetUserId: userId,
            resourceType: 'role',
            metadata: {
                roleCount: roles.length,
                roles: roles.map(r => ({ roleName: r.roleName, roleKey: r.roleKey, contextId: r.contextId, contextType: r.contextType }))
            },
        }, serviceContext);
    }
}
exports.RoleService = RoleService;
