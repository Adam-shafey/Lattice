"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPermissionRoutes = registerPermissionRoutes;
const zod_1 = require("zod");
function registerPermissionRoutes(app, prefix = '') {
    const p = prefix;
    const policy = app.routePolicy;
    const grantPre = app.routeAuth(policy.permissions.grantUser, { scope: 'global' });
    app.route({
        method: 'POST',
        path: `${p}/permissions/user/grant`,
        ...(grantPre && { preHandler: grantPre }),
        handler: async ({ body, req }) => {
            const schema = zod_1.z.object({
                userId: zod_1.z.string().min(1),
                permissionKey: zod_1.z.string().min(1),
                contextType: zod_1.z.string().min(1).optional(),
                contextId: zod_1.z.string().min(1).optional()
            }).refine((d) => !(d.contextType && d.contextId === undefined), {
                message: 'contextId required when contextType provided'
            });
            try {
                const parsed = schema.safeParse(body);
                if (!parsed.success)
                    return { error: 'Invalid input', issues: parsed.error.issues };
                const { userId, permissionKey, contextId, contextType } = parsed.data;
                await app.permissionService.grantToUser({
                    userId,
                    permissionKey,
                    contextId,
                    contextType,
                    context: { actorId: req?.user?.id || 'system' }
                });
                return { ok: true };
            }
            catch (error) {
                return { error: error.message || 'Failed to grant permission' };
            }
        },
    });
    const revokePre = app.routeAuth(policy.permissions.revokeUser, { scope: 'global' });
    app.route({
        method: 'POST',
        path: `${p}/permissions/user/revoke`,
        ...(revokePre && { preHandler: revokePre }),
        handler: async ({ body, req }) => {
            const schema = zod_1.z.object({
                userId: zod_1.z.string().min(1),
                permissionKey: zod_1.z.string().min(1),
                contextType: zod_1.z.string().min(1).optional(),
                contextId: zod_1.z.string().min(1).optional()
            }).refine((d) => !(d.contextType && d.contextId === undefined), {
                message: 'contextId required when contextType provided'
            });
            try {
                const parsed = schema.safeParse(body);
                if (!parsed.success)
                    return { error: 'Invalid input', issues: parsed.error.issues };
                const { userId, permissionKey, contextId, contextType } = parsed.data;
                await app.permissionService.revokeFromUser({
                    userId,
                    permissionKey,
                    contextId,
                    contextType,
                    context: { actorId: req?.user?.id || 'system' }
                });
                return { ok: true };
            }
            catch (error) {
                return { error: error.message || 'Failed to revoke permission' };
            }
        },
    });
    const userPermsPre = app.routeAuth(policy.permissions.grantUser, { scope: 'global' });
    app.route({
        method: 'GET',
        path: `${p}/permissions/user/:userId`,
        ...(userPermsPre && { preHandler: userPermsPre }),
        handler: async ({ params, query, req }) => {
            try {
                const { userId } = zod_1.z.object({ userId: zod_1.z.string().min(1) }).parse(params);
                const contextId = query.contextId;
                const contextType = query.contextType;
                const permissions = await app.permissionService.getUserPermissions({
                    userId,
                    contextId,
                    contextType,
                    context: { actorId: req?.user?.id || 'system' }
                });
                return permissions;
            }
            catch (error) {
                return { error: error.message || 'Failed to get user permissions' };
            }
        },
    });
    const effectivePre = app.routeAuth(policy.permissions.grantUser, { scope: 'global' });
    app.route({
        method: 'GET',
        path: `${p}/permissions/user/:userId/effective`,
        ...(effectivePre && { preHandler: effectivePre }),
        handler: async ({ params, query, req }) => {
            try {
                const { userId } = zod_1.z.object({ userId: zod_1.z.string().min(1) }).parse(params);
                const contextId = query.contextId;
                const permissions = await app.permissionService.getUserEffectivePermissions({
                    userId,
                    contextId,
                    context: { actorId: req?.user?.id || 'system' }
                });
                return permissions;
            }
            catch (error) {
                return { error: error.message || 'Failed to get effective permissions' };
            }
        },
    });
}
