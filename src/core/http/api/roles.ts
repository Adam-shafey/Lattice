import { CoreSaaSApp } from '../../../index';
import { RoleService } from '../../roles/role-service';
import { type RoutePermissionPolicy } from '../../policy/policy';
import { z } from 'zod';

export function registerRoleRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  const rs = new RoleService();

  app.route({
    method: 'POST',
    path: '/roles',
    preHandler: app.authorize(policy.roles!.create),
    handler: async ({ body, req }) => {
      const schema = z.object({ name: z.string().min(1) });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { name } = parsed.data;
      const role = await rs.createRole(name, { actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return role;
    },
  });

  app.route({
    method: 'GET',
    path: '/roles',
    preHandler: app.authorize(policy.roles!.list),
    handler: async ({ req }) => {
      const list = await rs.listRoles();
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'roles.list', success: true, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return list;
    },
  });

  app.route({
    method: 'GET',
    path: '/roles/:name',
    preHandler: app.authorize(policy.roles!.get),
    handler: async ({ params, req }) => {
      const all = await rs.listRoles();
      const role = all.find((r) => r.name === params.name);
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'roles.get', success: Boolean(role), requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent, metadata: { name: params.name } });
      return role ?? { error: 'Not found' };
    },
  });

  app.route({
    method: 'DELETE',
    path: '/roles/:name',
    preHandler: app.authorize(policy.roles!.delete),
    handler: async ({ params, req }) => {
      const ps = z.object({ name: z.string().min(1) }).parse(params);
      await rs.deleteRole(ps.name, { actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/assign',
    preHandler: app.authorize(policy.roles!.assign),
    handler: async ({ body, req }) => {
      const schema = z.object({ roleName: z.string().min(1), userId: z.string().min(1), contextId: z.string().min(1).optional() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { roleName, userId, contextId } = parsed.data;
      await rs.assignRoleToUser({ roleName, userId, contextId, actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/remove',
    preHandler: app.authorize(policy.roles!.remove),
    handler: async ({ body, req }) => {
      const schema = z.object({ roleName: z.string().min(1), userId: z.string().min(1), contextId: z.string().min(1).optional() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { roleName, userId, contextId } = parsed.data;
      await rs.removeRoleFromUser({ roleName, userId, contextId, actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/:name/permissions/add',
    preHandler: app.authorize(policy.roles!.addPerm),
    handler: async ({ params, body, req }) => {
      const ps = z.object({ name: z.string().min(1) }).parse(params);
      const schema = z.object({ permissionKey: z.string().min(1), contextId: z.string().min(1).optional() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { permissionKey, contextId } = parsed.data;
      await rs.addPermissionToRole({ roleName: ps.name, permissionKey, contextId, actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/:name/permissions/remove',
    preHandler: app.authorize(policy.roles!.removePerm),
    handler: async ({ params, body, req }) => {
      const ps = z.object({ name: z.string().min(1) }).parse(params);
      const schema = z.object({ permissionKey: z.string().min(1), contextId: z.string().min(1).optional() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { permissionKey, contextId } = parsed.data;
      await rs.removePermissionFromRole({ roleName: ps.name, permissionKey, contextId, actorId: (req?.user?.id as string) ?? null, source: 'api' });
      return { ok: true };
    },
  });
}


