"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPolicyRoutes = registerPolicyRoutes;
const zod_1 = require("zod");
function registerPolicyRoutes(app, prefix = '') {
    const p = prefix;
    const managePre = app.routeAuth('policies:manage', { scope: 'global' });
    // Create policy
    app.route({
        method: 'POST',
        path: `${p}/policies`,
        ...(managePre && { preHandler: managePre }),
        handler: async ({ body }) => {
            const schema = zod_1.z.object({
                action: zod_1.z.string(),
                resource: zod_1.z.string(),
                condition: zod_1.z.string(),
                effect: zod_1.z.enum(['permit', 'deny'])
            });
            const parsed = schema.safeParse(body);
            if (!parsed.success)
                return { error: 'Invalid input', issues: parsed.error.issues };
            const policy = await app.policyService.createPolicy(parsed.data);
            return policy;
        }
    });
    // List policies
    app.route({
        method: 'GET',
        path: `${p}/policies`,
        ...(managePre && { preHandler: managePre }),
        handler: async () => {
            return app.policyService.listPolicies();
        }
    });
    // Get policy
    app.route({
        method: 'GET',
        path: `${p}/policies/:id`,
        ...(managePre && { preHandler: managePre }),
        handler: async ({ params }) => {
            const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(params);
            const policy = await app.policyService.getPolicy(id);
            if (!policy)
                return { error: 'Policy not found' };
            return policy;
        }
    });
    // Update policy
    app.route({
        method: 'PUT',
        path: `${p}/policies/:id`,
        ...(managePre && { preHandler: managePre }),
        handler: async ({ params, body }) => {
            const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(params);
            const schema = zod_1.z.object({
                action: zod_1.z.string().optional(),
                resource: zod_1.z.string().optional(),
                condition: zod_1.z.string().optional(),
                effect: zod_1.z.enum(['permit', 'deny']).optional()
            });
            const parsed = schema.safeParse(body);
            if (!parsed.success)
                return { error: 'Invalid input', issues: parsed.error.issues };
            const policy = await app.policyService.updatePolicy(id, parsed.data);
            return policy;
        }
    });
    // Delete policy
    app.route({
        method: 'DELETE',
        path: `${p}/policies/:id`,
        ...(managePre && { preHandler: managePre }),
        handler: async ({ params }) => {
            const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(params);
            await app.policyService.deletePolicy(id);
            return { deleted: true };
        }
    });
}
