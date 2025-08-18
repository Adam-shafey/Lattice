import { LatticeCore } from '../../../index';
import { z } from 'zod';
import { logger } from '../../logger';

export function registerPolicyRoutes(app: LatticeCore, prefix: string = '') {
  const p = prefix;
  const managePre = app.routeAuth('policies:manage', { scope: 'global' });

  // Create policy
  app.route({
    method: 'POST',
    path: `${p}/policies`,
    ...(managePre && { preHandler: managePre }),
    handler: async ({ body }) => {
      const schema = z.object({
        action: z.string(),
        resource: z.string(),
        condition: z.string(),
        effect: z.enum(['permit', 'deny'])
      });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
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
      const { id } = z.object({ id: z.string() }).parse(params);
      const policy = await app.policyService.getPolicy(id);
      if (!policy) return { error: 'Policy not found' };
      return policy;
    }
  });

  // Update policy
  app.route({
    method: 'PUT',
    path: `${p}/policies/:id`,
    ...(managePre && { preHandler: managePre }),
    handler: async ({ params, body }) => {
      const { id } = z.object({ id: z.string() }).parse(params);
      const schema = z.object({
        action: z.string().optional(),
        resource: z.string().optional(),
        condition: z.string().optional(),
        effect: z.enum(['permit', 'deny']).optional()
      });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
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
      const { id } = z.object({ id: z.string() }).parse(params);
      await app.policyService.deletePolicy(id);
      return { deleted: true };
    }
  });
}
