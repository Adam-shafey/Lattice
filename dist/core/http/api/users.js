"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUserRoutes = registerUserRoutes;
const zod_1 = require("zod");
const logger_1 = require("../../logger");
function registerUserRoutes(app, prefix = '') {
    const p = prefix;
    const policy = app.routePolicy;
    const createPre = app.routeAuth(policy.users.create, { scope: 'global' });
    app.route({
        method: 'POST',
        path: `${p}/users`,
        ...(createPre && { preHandler: createPre }),
        handler: async ({ body, req }) => {
            const schema = zod_1.z.object({
                email: zod_1.z.string().email(),
                password: zod_1.z.string().min(6)
            });
            try {
                const parsed = schema.safeParse(body);
                if (!parsed.success)
                    return { error: 'Invalid input', issues: parsed.error.issues };
                const { email, password } = parsed.data;
                const user = await app.userService.createUser({
                    email,
                    password,
                    context: { actorId: req?.user?.id || 'system' }
                });
                return { id: user.id, email: user.email };
            }
            catch (error) {
                return { error: error.message || 'Failed to create user' };
            }
        },
    });
    const listPre = app.routeAuth(policy.users.list, { scope: 'global' });
    app.route({
        method: 'GET',
        path: `${p}/users`,
        ...(listPre && { preHandler: listPre }),
        handler: async ({ query, req }) => {
            const limit = query.limit ? parseInt(query.limit) : undefined;
            const offset = query.offset ? parseInt(query.offset) : undefined;
            logger_1.logger.log('👥 [USERS_ROUTE] Listing users', { userId: req?.user?.id, limit, offset });
            try {
                const result = await app.userService.listUsers({
                    limit,
                    offset,
                    context: { actorId: req?.user?.id || 'system' }
                });
                return result.users.map(user => ({
                    id: user.id,
                    email: user.email,
                    createdAt: user.createdAt
                }));
            }
            catch (error) {
                return { error: error.message || 'Failed to list users' };
            }
        },
    });
    const getPre = app.routeAuth(policy.users.get, { scope: 'global' });
    app.route({
        method: 'GET',
        path: `${p}/users/:id`,
        ...(getPre && { preHandler: getPre }),
        handler: async ({ params, req }) => {
            try {
                const { id } = zod_1.z.object({ id: zod_1.z.string().min(1) }).parse(params);
                const user = await app.userService.getUserById(id, {
                    actorId: req?.user?.id || 'system'
                });
                if (!user)
                    return { error: 'User not found' };
                return {
                    id: user.id,
                    email: user.email,
                    createdAt: user.createdAt
                };
            }
            catch (error) {
                return { error: error.message || 'Failed to get user' };
            }
        },
    });
    const updatePre = app.routeAuth(policy.users.update, { scope: 'global' });
    app.route({
        method: 'PUT',
        path: `${p}/users/:id`,
        ...(updatePre && { preHandler: updatePre }),
        handler: async ({ params, body, req }) => {
            const schema = zod_1.z.object({
                email: zod_1.z.string().email().optional(),
                password: zod_1.z.string().min(6).optional()
            });
            try {
                const { id } = zod_1.z.object({ id: zod_1.z.string().min(1) }).parse(params);
                const parsed = schema.safeParse(body);
                if (!parsed.success)
                    return { error: 'Invalid input', issues: parsed.error.issues };
                const updates = parsed.data;
                const user = await app.userService.updateUser(id, updates, {
                    actorId: req?.user?.id || 'system'
                });
                return { id: user.id, email: user.email };
            }
            catch (error) {
                return { error: error.message || 'Failed to update user' };
            }
        },
    });
    const deletePre = app.routeAuth(policy.users.delete, { scope: 'global' });
    app.route({
        method: 'DELETE',
        path: `${p}/users/:id`,
        ...(deletePre && { preHandler: deletePre }),
        handler: async ({ params, req }) => {
            try {
                const { id } = zod_1.z.object({ id: zod_1.z.string().min(1) }).parse(params);
                await app.userService.deleteUser(id, {
                    actorId: req?.user?.id || 'system'
                });
                return { ok: true };
            }
            catch (error) {
                return { error: error.message || 'Failed to delete user' };
            }
        },
    });
    const changePre = app.routeAuth(policy.users.update);
    app.route({
        method: 'POST',
        path: '/users/:id/password/change',
        ...(changePre && { preHandler: changePre }),
        handler: async ({ params, body, req }) => {
            const schema = zod_1.z.object({
                oldPassword: zod_1.z.string().min(6),
                newPassword: zod_1.z.string().min(6)
            });
            try {
                const { id } = zod_1.z.object({ id: zod_1.z.string().min(1) }).parse(params);
                const parsed = schema.safeParse(body);
                if (!parsed.success)
                    return { error: 'Invalid input', issues: parsed.error.issues };
                const { oldPassword, newPassword } = parsed.data;
                await app.userService.changePassword(id, oldPassword, newPassword, {
                    actorId: req?.user?.id || 'system'
                });
                return { ok: true };
            }
            catch (error) {
                return { error: error.message || 'Failed to change password' };
            }
        },
    });
}
