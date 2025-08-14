import { CoreSaaSApp } from '../../../index';
import { getDbClient } from '../../db/db-client';
import bcrypt from 'bcryptjs';
import { type RoutePermissionPolicy } from '../../policy/policy';
import { z } from 'zod';

export function registerUserRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  const db = getDbClient();

  app.route({
    method: 'POST',
    path: '/users',
    preHandler: app.authorize(policy.users!.create),
		handler: async ({ body, req }) => {
			const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
			const parsed = schema.safeParse(body);
			if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
			const { email, password } = parsed.data;
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await db.user.create({ data: { email, passwordHash } });
      await app.auditService.log({
        actorId: (req?.user?.id as string) ?? null,
        targetUserId: user.id,
        action: 'users.create',
        success: true,
        requestId: req?.requestId,
        ip: req?.clientIp,
        userAgent: req?.userAgent,
      });
      return { id: user.id, email: user.email };
    },
  });

  app.route({
    method: 'GET',
    path: '/users',
    preHandler: app.authorize(policy.users!.list),
    handler: async ({ req }) => {
      const users = await db.user.findMany({ select: { id: true, email: true, createdAt: true } });
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'users.list', success: true, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return users;
    },
  });

  app.route({
    method: 'GET',
    path: '/users/:id',
    preHandler: app.authorize(policy.users!.get),
		handler: async ({ params, req }) => {
			const ps = z.object({ id: z.string().min(1) }).parse(params);
			const user = await db.user.findUnique({ where: { id: ps.id }, select: { id: true, email: true, createdAt: true } });
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, targetUserId: params.id, action: 'users.get', success: Boolean(user), requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      if (!user) return { error: 'Not found' };
      return user;
    },
  });

  app.route({
    method: 'PUT',
    path: '/users/:id',
    preHandler: app.authorize(policy.users!.update),
		handler: async ({ params, body, req }) => {
			const ps = z.object({ id: z.string().min(1) }).parse(params);
			const schema = z.object({ email: z.string().email().optional() });
			const parsed = schema.safeParse(body);
			if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
			const { email } = parsed.data;
			const user = await db.user.update({ where: { id: ps.id }, data: { email } });
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, targetUserId: params.id, action: 'users.update', success: true, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return { id: user.id, email: user.email };
    },
  });

  app.route({
    method: 'DELETE',
    path: '/users/:id',
    preHandler: app.authorize(policy.users!.delete),
		handler: async ({ params, req }) => {
			const ps = z.object({ id: z.string().min(1) }).parse(params);
			const ok = await db.user.delete({ where: { id: ps.id } }).then(() => true).catch(() => false);
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, targetUserId: params.id, action: 'users.delete', success: ok, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return { ok: true };
    },
  });
}


