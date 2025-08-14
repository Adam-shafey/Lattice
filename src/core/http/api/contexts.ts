import { CoreSaaSApp } from '../../../index';
import { getDbClient } from '../../db/db-client';
import { type RoutePermissionPolicy } from '../../policy/policy';

export function registerContextRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  const db = getDbClient();

  app.route({
    method: 'POST',
    path: '/contexts',
    preHandler: app.authorize(policy.contexts!.create),
    handler: async ({ body }) => {
      const { id, type, parentId } = body as { id: string; type: string; parentId?: string | null };
      const ctx = await db.context.create({ data: { id, type, parentId: parentId ?? null } });
      return ctx;
    },
  });

  app.route({
    method: 'GET',
    path: '/contexts/:id',
    preHandler: app.authorize(policy.contexts!.get),
    handler: async ({ params }) => {
      const ctx = await db.context.findUnique({ where: { id: params.id } });
      return ctx ?? { error: 'Not found' };
    },
  });

  app.route({
    method: 'PUT',
    path: '/contexts/:id',
    preHandler: app.authorize(policy.contexts!.update),
    handler: async ({ params, body }) => {
      const { type, parentId } = body as { type?: string; parentId?: string | null };
      const ctx = await db.context.update({ where: { id: params.id }, data: { type, parentId: parentId ?? null } });
      return ctx;
    },
  });

  app.route({
    method: 'DELETE',
    path: '/contexts/:id',
    preHandler: app.authorize(policy.contexts!.delete),
    handler: async ({ params }) => {
      await db.context.delete({ where: { id: params.id } }).catch(() => {});
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/contexts/:id/users/add',
    preHandler: app.authorize(policy.contexts!.addUser),
    handler: async ({ params, body }) => {
      const { userId } = body as { userId: string };
      const id = `${userId}-${params.id}`;
      await db.userContext.upsert({ where: { id }, update: {}, create: { id, userId, contextId: params.id } });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/contexts/:id/users/remove',
    preHandler: app.authorize(policy.contexts!.removeUser),
    handler: async ({ params, body }) => {
      const { userId } = body as { userId: string };
      const id = `${userId}-${params.id}`;
      await db.userContext.delete({ where: { id } }).catch(() => {});
      return { ok: true };
    },
  });
}


