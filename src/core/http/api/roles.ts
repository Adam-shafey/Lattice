import { CoreSaaSApp } from '../../../index';
import { RoleService } from '../../services/role-service';
import { type RoutePermissionPolicy } from '../../policy/policy';
import { z } from 'zod';

export function registerRoleRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  const rs = new RoleService(app);

  app.route({
    method: 'POST',
    path: '/roles',
    preHandler: (req: any, res: any, next: () => void) => {
      const { contextType } = req.body;
      return app.authorize(policy.roles!.create.replace('{type}', contextType), { 
      scope: 'type-wide',
      contextType: 'required'
    })(req, res, next);
    },
    handler: async ({ body, req }: { body: any; req: any }) => {
      const schema = z.object({ 
        name: z.string().min(1),
        contextType: z.string().min(1)
      });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { name, contextType } = parsed.data;
      const role = await rs.createRole(name, { 
        actorId: (req?.user?.id as string) ?? null, 
        source: 'api',
        contextType
      });
      return role;
    },
  });

  app.route({
    method: 'GET',
    path: '/roles',
    preHandler: app.authorize(policy.roles!.list, { scope: 'global' }),
    handler: async ({ req }) => {
      const list = await rs.listRoles();
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'roles.list', success: true, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return list;
    },
  });

  app.route({
    method: 'GET',
    path: '/roles/:name',
    preHandler: app.authorize(policy.roles!.get, { scope: 'global' }),
    handler: async ({ params, req }) => {
      const all = await rs.listRoles();
      const role = all.find((r: { name: string; key: string }) => r.name === params.name);
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'roles.get', success: Boolean(role), requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent, metadata: { name: params.name } });
      return role ?? { error: 'Not found' };
    },
  });

  app.route({
    method: 'DELETE',
    path: '/roles/:name',
    preHandler: app.authorize(policy.roles!.delete, { scope: 'global' }),
    handler: async ({ params, req }) => {
      const ps = z.object({ name: z.string().min(1) }).parse(params);
      await rs.deleteRole(ps.name, { actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/assign',
    preHandler: app.authorize(policy.roles!.assign, { scope: 'exact', contextRequired: true }),
    handler: async ({ body, req }) => {
      const schema = z.object({ 
        roleName: z.string().min(1).optional(), 
        roleKey: z.string().uuid().optional(), 
        userId: z.string().min(1), 
        contextId: z.string().min(1), 
        contextType: z.string().min(1)
      }).refine((d) => d.roleName || d.roleKey, { message: 'roleName or roleKey required' });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { roleName, roleKey, userId, contextId, contextType } = parsed.data;
      await rs.assignRoleToUser({ roleName, roleKey, userId, contextId, contextType, actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/remove',
    preHandler: app.authorize(policy.roles!.remove, { scope: 'exact', contextRequired: true }),
    handler: async ({ body, req }) => {
      const schema = z.object({ 
        roleName: z.string().min(1).optional(), 
        roleKey: z.string().uuid().optional(), 
        userId: z.string().min(1), 
        contextId: z.string().min(1), 
        contextType: z.string().min(1)
      }).refine((d) => d.roleName || d.roleKey, { message: 'roleName or roleKey required' });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { roleName, roleKey, userId, contextId, contextType } = parsed.data;
      await rs.removeRoleFromUser({ roleName, roleKey, userId, contextId, contextType, actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/:name/permissions/add',
    preHandler: [
      // Must have role management permission for this type
      (req: any, res: any, next: () => void) => {
        const { contextType } = req.body;
        return app.authorize(policy.roles!.addPerm.roleManage.replace('{type}', contextType), {
        scope: 'type-wide',
        contextType: 'required'
      })(req, res, next);
      },
      // Must have permission grant ability for this permission in this context
      async (req: any, res: any, next: () => void) => {
        const { permissionKey, contextType } = req.body;
        const allowed = await app.checkAccess({
          userId: req.user.id,
          permission: policy.roles!.addPerm.permissionGrant
            .replace('{perm}', permissionKey)
            .replace('{type}', contextType),
          scope: 'type-wide',
          contextType
        });
        if (!allowed) {
          return res.status(403).send({ error: 'Cannot grant permissions you do not have' });
        }
        next();
      }
    ],
    handler: async ({ params, body, req }) => {
      const ps = z.object({ name: z.string().min(1) }).parse(params);
      const schema = z.object({ permissionKey: z.string().min(1), contextId: z.string().min(1).optional(), contextType: z.string().min(1).optional() })
        .refine((d) => !(d.contextId && d.contextType), { message: 'Provide either contextId for exact, or contextType for type-wide, not both' });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { permissionKey, contextId, contextType } = parsed.data;
      await rs.addPermissionToRole({ 
        roleName: ps.name, 
        permissionKey, 
        contextId, 
        contextType, 
        actorId: (req?.user?.id as string) ?? null, 
        source: 'api',
        policy
      });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/:name/permissions/remove',
    preHandler: [
      // Must have role management permission for this type
      (req: any, res: any, next: () => void) => {
        const { contextType } = req.body;
        return app.authorize(policy.roles!.removePerm.roleManage.replace('{type}', contextType), {
          scope: 'type-wide',
          contextType: 'required'
        })(req, res, next);
      },
      // Must have permission revoke ability for this permission in this context
      async (req: any, res: any, next: () => void) => {
        const { permissionKey, contextType } = req.body;
        const allowed = await app.checkAccess({
          userId: req.user.id,
          permission: policy.roles!.removePerm.permissionRevoke
            .replace('{perm}', permissionKey)
            .replace('{type}', contextType),
          scope: 'type-wide',
          contextType
        });
        if (!allowed) {
          return res.status(403).send({ error: 'Cannot revoke permissions you do not have' });
        }
        next();
      }
    ],
    handler: async ({ params, body, req }) => {
      const ps = z.object({ name: z.string().min(1) }).parse(params);
      const schema = z.object({ permissionKey: z.string().min(1), contextId: z.string().min(1).optional(), contextType: z.string().min(1).optional() })
        .refine((d) => !(d.contextId && d.contextType), { message: 'Provide either contextId for exact, or contextType for type-wide, not both' });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { permissionKey, contextId, contextType } = parsed.data;
      await rs.removePermissionFromRole({ roleName: ps.name, permissionKey, contextId, contextType, actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return { ok: true };
    },
  });
}


