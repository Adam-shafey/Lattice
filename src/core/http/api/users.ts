import { CoreSaaSApp } from '../../../index';
import { type RoutePermissionPolicy } from '../../policy/policy';
import { z } from 'zod';

export function registerUserRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  app.route({
    method: 'POST',
    path: '/users',
    preHandler: app.authorize(policy.users!.create),
    handler: async ({ body, req }) => {
      const schema = z.object({ 
        email: z.string().email(), 
        password: z.string().min(6) 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { email, password } = parsed.data;
        const user = await app.userService.createUser({
          email,
          password,
          context: { actorId: req?.user?.id || 'system' }
        });
        
        return { id: user.id, email: user.email };
      } catch (error: any) {
        return { error: error.message || 'Failed to create user' };
      }
    },
  });

  app.route({
    method: 'GET',
    path: '/users',
    preHandler: app.authorize(policy.users!.list),
    handler: async ({ query, req }) => {
      try {
        const limit = query.limit ? parseInt(query.limit as string) : undefined;
        const offset = query.offset ? parseInt(query.offset as string) : undefined;
        
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
      } catch (error: any) {
        return { error: error.message || 'Failed to list users' };
      }
    },
  });

  app.route({
    method: 'GET',
    path: '/users/:id',
    preHandler: app.authorize(policy.users!.get),
    handler: async ({ params, req }) => {
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        const user = await app.userService.getUserById(id, {
          actorId: req?.user?.id || 'system'
        });
        
        if (!user) return { error: 'User not found' };
        
        return {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt
        };
      } catch (error: any) {
        return { error: error.message || 'Failed to get user' };
      }
    },
  });

  app.route({
    method: 'PUT',
    path: '/users/:id',
    preHandler: app.authorize(policy.users!.update),
    handler: async ({ params, body, req }) => {
      const schema = z.object({ 
        email: z.string().email().optional(),
        password: z.string().min(6).optional()
      });
      
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const updates = parsed.data;
        const user = await app.userService.updateUser(id, updates, {
          actorId: req?.user?.id || 'system'
        });
        
        return { id: user.id, email: user.email };
      } catch (error: any) {
        return { error: error.message || 'Failed to update user' };
      }
    },
  });

  app.route({
    method: 'DELETE',
    path: '/users/:id',
    preHandler: app.authorize(policy.users!.delete),
    handler: async ({ params, req }) => {
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        await app.userService.deleteUser(id, {
          actorId: req?.user?.id || 'system'
        });
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to delete user' };
      }
    },
  });

  app.route({
    method: 'POST',
    path: '/users/:id/password/change',
    preHandler: app.authorize(policy.users!.update),
    handler: async ({ params, body, req }) => {
      const schema = z.object({ 
        oldPassword: z.string().min(6), 
        newPassword: z.string().min(6) 
      });
      
      try {
        const { id } = z.object({ id: z.string().min(1) }).parse(params);
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { oldPassword, newPassword } = parsed.data;
        await app.userService.changePassword(id, oldPassword, newPassword, {
          actorId: req?.user?.id || 'system'
        });
        
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to change password' };
      }
    },
  });

  app.route({
    method: 'POST',
    path: '/users/password/reset/request',
    handler: async ({ body }) => {
      const schema = z.object({ 
        email: z.string().email() 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { email } = parsed.data;
        await app.userService.resetPassword(email, {
          actorId: 'system'
        });
        
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to request password reset' };
      }
    },
  });
}


