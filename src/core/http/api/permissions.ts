import { CoreSaaSApp } from '../../../index';
import { UserPermissionService } from '../../permissions/user-permission-service';
import { type RoutePermissionPolicy } from '../../policy/policy';
import { z } from 'zod';

export function registerPermissionRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  const ups = new UserPermissionService();

  app.route({
    method: 'POST',
    path: '/permissions/user/grant',
    preHandler: app.authorize(policy.permissions!.grantUser),
    handler: async ({ body, req }) => {
      const schema = z.object({ userId: z.string().min(1), permissionKey: z.string().min(1), contextId: z.string().min(1).optional() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { userId, permissionKey, contextId } = parsed.data;
      await ups.grantToUser({ userId, permissionKey, contextId });
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'permissions.user.grant', success: true, contextId: contextId ?? null, targetUserId: userId, metadata: { permissionKey } });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/permissions/user/revoke',
    preHandler: app.authorize(policy.permissions!.revokeUser),
    handler: async ({ body, req }) => {
      const schema = z.object({ userId: z.string().min(1), permissionKey: z.string().min(1), contextId: z.string().min(1).optional() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { userId, permissionKey, contextId } = parsed.data;
      await ups.revokeFromUser({ userId, permissionKey, contextId });
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'permissions.user.revoke', success: true, contextId: contextId ?? null, targetUserId: userId, metadata: { permissionKey } });
      return { ok: true };
    },
  });
}


