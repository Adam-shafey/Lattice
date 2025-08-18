import { LatticeCore } from '../../../index';
import { z } from 'zod';
import { logger } from '../../logger';

export function registerRoleRoutes(app: LatticeCore, prefix: string = '') {
  const p = prefix;
  const policy = app.routePolicy;

  const createPre: any[] = [
    ...(app.authnEnabled ? [app.requireAuth()] : []),
    ...(app.authzEnabled
      ? [
          (req: any, res: any, next: () => void) => {
            const { contextType } = req.body;
            return app
              .authorize(policy.roles.create.replace('{type}', contextType), {
                scope: 'type-wide',
                contextType: 'required',
              })(req, res, next);
          },
        ]
      : []),
  ];
  app.route({
    method: 'POST',
    path: `${p}/roles`,
    ...(createPre.length && { preHandler: createPre }),
    handler: async ({ body, req }) => {
      const schema = z.object({
        name: z.string().min(1),
        contextType: z.string().min(1),
        key: z.string().optional()
      });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      
      try {
        const { name, contextType, key } = parsed.data;
        const role = await app.roleService.createRole({
          name,
          contextType,
          key,
          context: { actorId: req?.user?.id || 'system' }
        });
        return role;
      } catch (error: any) {
        return { error: error.message || 'Failed to create role' };
      }
    },
  });

  const listPre: any[] = [
    ...(app.authnEnabled ? [app.requireAuth()] : []),
    ...(app.authzEnabled
      ? [
          (req: any, res: any, next: () => void) => {
            const { contextType } = req.query;
            return app
              .authorize(policy.roles.list.replace('{type}', contextType || 'team'), {
                scope: 'type-wide',
                contextType: 'required',
              })(req, res, next);
          },
        ]
      : []),
  ];
  app.route({
    method: 'GET',
    path: `${p}/roles`,
    ...(listPre.length && { preHandler: listPre }),
    handler: async ({ query, req }) => {
      try {
        const contextType = query.contextType as string | undefined;
        const roles = await app.roleService.listRoles({
          contextType,
          context: { actorId: req?.user?.id || 'system' }
        });
        return roles;
      } catch (error: any) {
        return { error: error.message || 'Failed to list roles' };
      }
    },
  });

  const getPre: any[] = [
    ...(app.authnEnabled ? [app.requireAuth()] : []),
    ...(app.authzEnabled
      ? [
          (req: any, res: any, next: () => void) => {
            const { contextType } = req.query;
            return app
              .authorize(policy.roles.get.replace('{type}', contextType || 'team'), {
                scope: 'type-wide',
                contextType: 'required',
              })(req, res, next);
          },
        ]
      : []),
  ];
  app.route({
    method: 'GET',
    path: `${p}/roles/:name`,
    ...(getPre.length && { preHandler: getPre }),
    handler: async ({ params, req }) => {
      try {
        const { name } = z.object({ name: z.string().min(1) }).parse(params);
        const role = await app.roleService.getRoleByName(name, {
          actorId: req?.user?.id || 'system'
        });
        if (!role) return { error: 'Role not found' };
        return role;
      } catch (error: any) {
        return { error: error.message || 'Failed to get role' };
      }
    },
  });

  const deletePre: any[] = [
    ...(app.authnEnabled ? [app.requireAuth()] : []),
    ...(app.authzEnabled
      ? [
          (req: any, res: any, next: () => void) => {
            const { contextType } = req.query;
            return app
              .authorize(policy.roles.delete.replace('{type}', contextType || 'team'), {
                scope: 'type-wide',
                contextType: 'required',
              })(req, res, next);
          },
        ]
      : []),
  ];
  app.route({
    method: 'DELETE',
    path: `${p}/roles/:name`,
    ...(deletePre.length && { preHandler: deletePre }),
    handler: async ({ params, req }) => {
      try {
        const { name } = z.object({ name: z.string().min(1) }).parse(params);
        await app.roleService.deleteRole(name, {
          actorId: req?.user?.id || 'system'
        });
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to delete role' };
      }
    },
  });

  const assignPre: any[] = [
    ...(app.authnEnabled ? [app.requireAuth()] : []),
    ...(app.authzEnabled
      ? [
          (req: any, res: any, next: () => void) => {
            const { contextType } = req.body;
            if (!contextType) {
              res.status(403).send({ error: 'Missing contextType' });
              return;
            }
            return app
              .authorize(policy.roles.assign.replace('{type}', contextType), {
                scope: 'type-wide',
                contextType: 'required',
              })(req, res, next);
          },
        ]
      : []),
  ];
  app.route({
    method: 'POST',
    path: `${p}/roles/assign`,
    ...(assignPre.length && { preHandler: assignPre }),
    handler: async ({ body, req }) => {
      const schema = z.object({
        roleName: z.string().min(1).optional(),
        roleKey: z.string().optional(),
        userId: z.string().min(1),
        contextId: z.string().min(1), 
        contextType: z.string().min(1)
      }).refine((d) => d.roleName || d.roleKey, { message: 'roleName or roleKey required' });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { roleName, roleKey, userId, contextId, contextType } = parsed.data;
        await app.roleService.assignRoleToUser({
          roleName,
          roleKey,
          userId,
          contextId,
          contextType,
          context: { actorId: req?.user?.id || 'system' }
        });
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to assign role' };
      }
    },
  });

  const removePre: any[] = [
    ...(app.authnEnabled ? [app.requireAuth()] : []),
    ...(app.authzEnabled
      ? [
          (req: any, res: any, next: () => void) => {
            const { contextType } = req.body;
            if (!contextType) {
              res.status(403).send({ error: 'Missing contextType' });
              return;
            }
            return app
              .authorize(policy.roles.remove.replace('{type}', contextType), {
                scope: 'type-wide',
                contextType: 'required',
              })(req, res, next);
          },
        ]
      : []),
  ];
  app.route({
    method: 'POST',
    path: `${p}/roles/remove`,
    ...(removePre.length && { preHandler: removePre }),
    handler: async ({ body, req }) => {
      const schema = z.object({
        roleName: z.string().min(1).optional(),
        roleKey: z.string().optional(),
        userId: z.string().min(1),
        contextId: z.string().min(1),
        contextType: z.string().min(1)
      }).refine((d) => d.roleName || d.roleKey, { message: 'roleName or roleKey required' });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { roleName, roleKey, userId, contextId, contextType } = parsed.data;
        await app.roleService.removeRoleFromUser({
          roleName,
          roleKey,
          userId,
          contextId,
          contextType,
          context: { actorId: req?.user?.id || 'system' }
        });
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to remove role' };
      }
    },
  });

  const addPermPre: any[] = [
    ...(app.authnEnabled ? [app.requireAuth()] : []),
    ...(app.authzEnabled
      ? [
          (req: any, res: any, next: () => void) => {
            const { contextType, contextId } = req.body;
            const effectiveContextType = contextType || (contextId ? 'team' : null);
            if (!effectiveContextType) {
              res.status(403).send({ error: 'Missing contextType or contextId' });
              return;
            }
            const permissionKey = policy.roles.addPerm.roleManage.replace(
              '{type}',
              effectiveContextType,
            );
            return app
              .authorize(permissionKey, {
                scope: 'type-wide',
                contextType: 'required',
              })(req, res, next);
          },
          (req: any, res: any, next: () => void) => {
            const { permissionKey, contextType, contextId } = req.body;
            const effectiveContextType = contextType || (contextId ? 'team' : null);
            if (!effectiveContextType) {
              res.status(403).send({ error: 'Missing contextType or contextId' });
              return;
            }
            const requiredPermission = policy.roles.addPerm.permissionGrant
              .replace('{perm}', permissionKey)
              .replace('{type}', effectiveContextType);
            return app
              .authorize(requiredPermission, {
                scope: 'type-wide',
                contextType: 'required',
              })(req, res, next);
          },
        ]
      : []),
  ];
  app.route({
    method: 'POST',
    path: `${p}/roles/:name/permissions/add`,
    ...(addPermPre.length && { preHandler: addPermPre }),
    handler: async ({ params, body, req }) => {
      const { name } = z.object({ name: z.string().min(1) }).parse(params);
      const schema = z.object({
        permissionKey: z.string().min(1),
        contextId: z.string().min(1).optional(),
        contextType: z.string().min(1).optional() 
      }).refine((d) => !(d.contextId && d.contextType), { 
        message: 'Provide either contextId for exact, or contextType for type-wide, not both' 
      });
      
      const parsed = schema.safeParse(body);
      logger.log('Validation result:', { success: parsed.success, body, issues: parsed.error?.issues });
      if (!parsed.success) {
        const error = new Error('Validation failed');
        (error as any).statusCode = 400;
        (error as any).issues = parsed.error.issues;
        throw error;
      }
      
      try {
        const { permissionKey, contextId, contextType } = parsed.data;
        await app.roleService.addPermissionToRole({
          roleName: name,
          permissionKey,
          contextId,
          contextType,
          context: { actorId: req?.user?.id || 'system' }
        });
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to add permission to role' };
      }
    },
  });

  const removePermPre: any[] = [
    ...(app.authnEnabled ? [app.requireAuth()] : []),
    ...(app.authzEnabled
      ? [
          (req: any, res: any, next: () => void) => {
            const { contextType } = req.body;
            return app
              .authorize(
                policy.roles.removePerm.roleManage.replace('{type}', contextType),
                { scope: 'type-wide', contextType: 'required' },
              )(req, res, next);
          },
          (req: any, res: any, next: () => void) => {
            const { permissionKey, contextType } = req.body;
            const requiredPermission = policy.roles.removePerm.permissionRevoke
              .replace('{perm}', permissionKey)
              .replace('{type}', contextType);
            return app
              .authorize(requiredPermission, {
                scope: 'type-wide',
                contextType: 'required',
              })(req, res, next);
          },
        ]
      : []),
  ];
  app.route({
    method: 'POST',
    path: `${p}/roles/:name/permissions/remove`,
    ...(removePermPre.length && { preHandler: removePermPre }),
    handler: async ({ params, body, req }) => {
      try {
        const { name } = z.object({ name: z.string().min(1) }).parse(params);
        const schema = z.object({
          permissionKey: z.string().min(1),
          contextId: z.string().min(1).optional(),
          contextType: z.string().min(1).optional()
        }).refine((d) => !(d.contextId && d.contextType), {
          message: 'Provide either contextId for exact, or contextType for type-wide, not both'
        });
  
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
  
        const { permissionKey, contextId, contextType } = parsed.data;
        await app.roleService.removePermissionFromRole({
          roleName: name,
          permissionKey,
          contextId,
          contextType,
          context: { actorId: req?.user?.id || 'system' }
        });
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Failed to remove permission from role' };
      }
    },
  });
}