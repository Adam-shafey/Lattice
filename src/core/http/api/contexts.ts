import { CoreSaaSApp } from '../../../index';
import { type RoutePermissionPolicy } from '../../policy/policy';
import { z } from 'zod';

export function registerContextRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  app.route({
    method: 'POST',
    path: '/contexts',
    preHandler: app.authorize(policy.contexts!.create),
    handler: async ({ body, req }) => {
      const schema = z.object({ 
        id: z.string().min(1), 
        type: z.string().min(1), 
        name: z.string().optional()
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { id, type, name } = parsed.data;
        const context = await app.contextService.createContext({
          id,
          type,
          name,
          context: { actorId: req?.user?.id || 'system' }
        });
        
        return context;
      } catch (error: any) {
        return { error: error.message || 'Failed to create context' };
      }
    },
  });

  app.route({
    method: 'GET',
    path: '/contexts/:id',
    preHandler: app.authorize(policy.contexts!.get),
    handler: async ({ params, req }) => {
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        const context = await app.contextService.getContext(id, {
          actorId: req?.user?.id || 'system'
        });
        
        if (!context) return { error: 'Context not found' };
        return context;
      } catch (error: any) {
        return { error: error.message || 'Failed to get context' };
      }
    },
  });

  app.route({
    method: 'PUT',
    path: '/contexts/:id',
    preHandler: app.authorize(policy.contexts!.update),
    handler: async ({ params, body, req }) => {
      const schema = z.object({ 
        name: z.string().optional(), 
        type: z.string().min(1).optional() 
      });
      
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const updates = parsed.data;
        const context = await app.contextService.updateContext(id, updates, {
          actorId: req?.user?.id || 'system'
        });
        
        return context;
      } catch (error: any) {
        return { error: error.message || 'Failed to update context' };
      }
    },
  });

  app.route({
    method: 'DELETE',
    path: '/contexts/:id',
    preHandler: app.authorize(policy.contexts!.delete),
    handler: async ({ params, req }) => {
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        await app.contextService.deleteContext(id, {
          actorId: req?.user?.id || 'system'
        });
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to delete context' };
      }
    },
  });

  app.route({
    method: 'POST',
    path: '/contexts/:id/users/add',
    preHandler: app.authorize(policy.contexts!.addUser),
    handler: async ({ params, body, req }) => {
      const schema = z.object({ 
        userId: z.string().min(1) 
      });
      
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { userId } = parsed.data;
        await app.contextService.addUserToContext({
          userId,
          contextId: id,
          context: { actorId: req?.user?.id || 'system' }
        });
        
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to add user to context' };
      }
    },
  });

  app.route({
    method: 'POST',
    path: '/contexts/:id/users/remove',
    preHandler: app.authorize(policy.contexts!.removeUser),
    handler: async ({ params, body, req }) => {
      const schema = z.object({ 
        userId: z.string().min(1) 
      });
      
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { userId } = parsed.data;
        await app.contextService.removeUserFromContext({
          userId,
          contextId: id,
          context: { actorId: req?.user?.id || 'system' }
        });
        
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to remove user from context' };
      }
    },
  });

  app.route({
    method: 'GET',
    path: '/contexts',
    preHandler: app.authorize(policy.contexts!.get),
    handler: async ({ query, req }) => {
      try {
        const type = query.type as string | undefined;
        const limit = query.limit ? parseInt(query.limit as string) : undefined;
        const offset = query.offset ? parseInt(query.offset as string) : undefined;
        
        const result = await app.contextService.listContexts({
          type,
          limit,
          offset,
          context: { actorId: req?.user?.id || 'system' }
        });
        
        return result;
      } catch (error: any) {
        return { error: error.message || 'Failed to list contexts' };
      }
    },
  });

  app.route({
    method: 'GET',
    path: '/contexts/:id/users',
    preHandler: app.authorize(policy.contexts!.get),
    handler: async ({ params, req }) => {
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        const users = await app.contextService.getContextUsers({
          contextId: id,
          context: { actorId: req?.user?.id || 'system' }
        });
        
        return users;
      } catch (error: any) {
        return { error: error.message || 'Failed to get context users' };
      }
    },
  });
}


