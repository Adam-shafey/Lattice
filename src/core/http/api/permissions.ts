import { CoreSaaSApp } from '../../../index';
import { type RoutePermissionPolicy } from '../../policy/policy';
import { z } from 'zod';

export function registerPermissionRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy, prefix: string = '') {
  const p = prefix;
  app.route({
    method: 'POST',
    path: `${p}/permissions/user/grant`,
    preHandler: [app.requireAuth(), app.authorize(policy.permissions!.grantUser, { scope: 'global' })],
    handler: async ({ body, req }) => {
      const schema = z.object({ 
        userId: z.string().min(1), 
        permissionKey: z.string().min(1), 
        contextType: z.string().min(1).optional(), 
        contextId: z.string().min(1).optional() 
      }).refine((d) => !(d.contextType && d.contextId === undefined), { 
        message: 'contextId required when contextType provided' 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { userId, permissionKey, contextId, contextType } = parsed.data;
        await app.permissionService.grantToUser({
          userId,
          permissionKey,
          contextId,
          contextType,
          context: { actorId: req?.user?.id || 'system' }
        });
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to grant permission' };
      }
    },
  });

  app.route({
    method: 'POST',
    path: `${p}/permissions/user/revoke`,
    preHandler: [app.requireAuth(), app.authorize(policy.permissions!.revokeUser, { scope: 'global' })],
    handler: async ({ body, req }) => {
      const schema = z.object({ 
        userId: z.string().min(1), 
        permissionKey: z.string().min(1), 
        contextType: z.string().min(1).optional(), 
        contextId: z.string().min(1).optional() 
      }).refine((d) => !(d.contextType && d.contextId === undefined), { 
        message: 'contextId required when contextType provided' 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { userId, permissionKey, contextId, contextType } = parsed.data;
        await app.permissionService.revokeFromUser({
          userId,
          permissionKey,
          contextId,
          contextType,
          context: { actorId: req?.user?.id || 'system' }
        });
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to revoke permission' };
      }
    },
  });

  app.route({
    method: 'GET',
    path: `${p}/permissions/user/:userId`,
    preHandler: [app.requireAuth(), app.authorize(policy.permissions!.grantUser, { scope: 'global' })],
    handler: async ({ params, query, req }) => {
      try {
        const { userId } = z.object({ userId: z.string().min(1) }).parse(params);
        const contextId = query.contextId as string | undefined;
        const contextType = query.contextType as string | undefined;
        
        const permissions = await app.permissionService.getUserPermissions({
          userId,
          contextId,
          contextType,
          context: { actorId: req?.user?.id || 'system' }
        });
        return permissions;
      } catch (error: any) {
        return { error: error.message || 'Failed to get user permissions' };
      }
    },
  });

  app.route({
    method: 'GET',
    path: `${p}/permissions/user/:userId/effective`,
    preHandler: [app.requireAuth(), app.authorize(policy.permissions!.grantUser, { scope: 'global' })],
    handler: async ({ params, query, req }) => {
      try {
        const { userId } = z.object({ userId: z.string().min(1) }).parse(params);
        const contextId = query.contextId as string | undefined;
        
        const permissions = await app.permissionService.getUserEffectivePermissions({
          userId,
          contextId,
          context: { actorId: req?.user?.id || 'system' }
        });
        return permissions;
      } catch (error: any) {
        return { error: error.message || 'Failed to get effective permissions' };
      }
    },
  });
}


