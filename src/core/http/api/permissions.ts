import { CoreSaaSApp } from '../../../index';
import { UserPermissionService } from '../../permissions/user-permission-service';
import { type RoutePermissionPolicy } from '../../policy/policy';

export function registerPermissionRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  const ups = new UserPermissionService();

  app.route({
    method: 'POST',
    path: '/permissions/user/grant',
    preHandler: app.authorize(policy.permissions!.grantUser),
    handler: async ({ body }) => {
      const { userId, permissionKey, contextId } = body as { userId: string; permissionKey: string; contextId?: string };
      await ups.grantToUser({ userId, permissionKey, contextId });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/permissions/user/revoke',
    preHandler: app.authorize(policy.permissions!.revokeUser),
    handler: async ({ body }) => {
      const { userId, permissionKey, contextId } = body as { userId: string; permissionKey: string; contextId?: string };
      await ups.revokeFromUser({ userId, permissionKey, contextId });
      return { ok: true };
    },
  });
}


