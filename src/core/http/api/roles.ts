import { CoreSaaSApp } from '../../../index';
import { RoleService } from '../../roles/role-service';
import { type RoutePermissionPolicy } from '../../policy/policy';

export function registerRoleRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  const rs = new RoleService();

  app.route({
    method: 'POST',
    path: '/roles',
    preHandler: app.authorize(policy.roles!.create),
    handler: async ({ body }) => {
      const { name } = body as { name: string };
      return rs.createRole(name);
    },
  });

  app.route({
    method: 'GET',
    path: '/roles',
    preHandler: app.authorize(policy.roles!.list),
    handler: async () => rs.listRoles(),
  });

  app.route({
    method: 'GET',
    path: '/roles/:name',
    preHandler: app.authorize(policy.roles!.get),
    handler: async ({ params }) => {
      const all = await rs.listRoles();
      return all.find((r) => r.name === params.name) ?? { error: 'Not found' };
    },
  });

  app.route({
    method: 'DELETE',
    path: '/roles/:name',
    preHandler: app.authorize(policy.roles!.delete),
    handler: async ({ params }) => {
      await rs.deleteRole(params.name);
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/assign',
    preHandler: app.authorize(policy.roles!.assign),
    handler: async ({ body }) => {
      const { roleName, userId, contextId } = body as { roleName: string; userId: string; contextId?: string };
      await rs.assignRoleToUser({ roleName, userId, contextId });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/remove',
    preHandler: app.authorize(policy.roles!.remove),
    handler: async ({ body }) => {
      const { roleName, userId, contextId } = body as { roleName: string; userId: string; contextId?: string };
      await rs.removeRoleFromUser({ roleName, userId, contextId });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/:name/permissions/add',
    preHandler: app.authorize(policy.roles!.addPerm),
    handler: async ({ params, body }) => {
      const { permissionKey, contextId } = body as { permissionKey: string; contextId?: string };
      await rs.addPermissionToRole({ roleName: params.name, permissionKey, contextId });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/roles/:name/permissions/remove',
    preHandler: app.authorize(policy.roles!.removePerm),
    handler: async ({ params, body }) => {
      const { permissionKey, contextId } = body as { permissionKey: string; contextId?: string };
      await rs.removePermissionFromRole({ roleName: params.name, permissionKey, contextId });
      return { ok: true };
    },
  });
}


