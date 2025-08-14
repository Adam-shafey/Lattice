import { CoreSaaSApp } from '../../../index';
import { getDbClient } from '../../db/db-client';
import bcrypt from 'bcryptjs';
import { type RoutePermissionPolicy } from '../../policy/policy';

export function registerUserRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  const db = getDbClient();

  app.route({
    method: 'POST',
    path: '/users',
    preHandler: app.authorize(policy.users!.create),
    handler: async ({ body }) => {
      const { email, password } = body as { email: string; password: string };
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await db.user.create({ data: { email, passwordHash } });
      return { id: user.id, email: user.email };
    },
  });

  app.route({
    method: 'GET',
    path: '/users',
    preHandler: app.authorize(policy.users!.list),
    handler: async () => {
      const users = await db.user.findMany({ select: { id: true, email: true, createdAt: true } });
      return users;
    },
  });

  app.route({
    method: 'GET',
    path: '/users/:id',
    preHandler: app.authorize(policy.users!.get),
    handler: async ({ params }) => {
      const user = await db.user.findUnique({ where: { id: params.id }, select: { id: true, email: true, createdAt: true } });
      if (!user) return { error: 'Not found' };
      return user;
    },
  });

  app.route({
    method: 'PUT',
    path: '/users/:id',
    preHandler: app.authorize(policy.users!.update),
    handler: async ({ params, body }) => {
      const { email } = body as { email?: string };
      const user = await db.user.update({ where: { id: params.id }, data: { email } });
      return { id: user.id, email: user.email };
    },
  });

  app.route({
    method: 'DELETE',
    path: '/users/:id',
    preHandler: app.authorize(policy.users!.delete),
    handler: async ({ params }) => {
      await db.user.delete({ where: { id: params.id } }).catch(() => {});
      return { ok: true };
    },
  });
}


