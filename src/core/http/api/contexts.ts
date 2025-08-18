import { LatticeCore } from '../../../index';
import { z } from 'zod';

export function registerContextRoutes(app: LatticeCore, prefix: string = '') {
  const p = prefix;
  const policy = app.routePolicy;
  const createPre = app.routeAuth(policy.contexts.create);
  app.route({
    method: 'POST',
    path: `${p}/contexts`,
    ...(createPre && { preHandler: createPre }),
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

  const getPre = app.routeAuth(policy.contexts.get);
  app.route({
    method: 'GET',
    path: `${p}/contexts/:id`,
    ...(getPre && { preHandler: getPre }),
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

  const updatePre = app.routeAuth(policy.contexts.update);
  app.route({
    method: 'PUT',
    path: `${p}/contexts/:id`,
    ...(updatePre && { preHandler: updatePre }),
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

  const deletePre = app.routeAuth(policy.contexts.delete);
  app.route({
    method: 'DELETE',
    path: `${p}/contexts/:id`,
    ...(deletePre && { preHandler: deletePre }),
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

  const addUserPre = app.routeAuth(policy.contexts.addUser);
  app.route({
    method: 'POST',
    path: `${p}/contexts/:id/users/add`,
    ...(addUserPre && { preHandler: addUserPre }),
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

  const removeUserPre = app.routeAuth(policy.contexts.removeUser);
  app.route({
    method: 'POST',
    path: `${p}/contexts/:id/users/remove`,
    ...(removeUserPre && { preHandler: removeUserPre }),
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

  const listPre = app.routeAuth(policy.contexts.get);
  app.route({
    method: 'GET',
    path: `${p}/contexts`,
    ...(listPre && { preHandler: listPre }),
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

  const listUsersPre = app.routeAuth(policy.contexts.get);
  app.route({
    method: 'GET',
    path: `${p}/contexts/:id/users`,
    ...(listUsersPre && { preHandler: listUsersPre }),
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


