import { CoreSaaSApp } from '../../../index';
import { getDbClient } from '../../db/db-client';
import { type RoutePermissionPolicy } from '../../policy/policy';
import { z } from 'zod';

export function registerContextRoutes(app: CoreSaaSApp, policy: RoutePermissionPolicy) {
  const db = getDbClient();

  app.route({
    method: 'POST',
    path: '/contexts',
    preHandler: app.authorize(policy.contexts!.create),
    handler: async ({ body, req }) => {
      const schema = z.object({ id: z.string().min(1), type: z.string().min(1), parentId: z.string().min(1).nullable().optional() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { id, type, parentId } = parsed.data;
      const ctx = await db.context.create({ data: { id, type, parentId: parentId ?? null } });
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'contexts.create', success: true, contextId: id, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return ctx;
    },
  });

  app.route({
    method: 'GET',
    path: '/contexts/:id',
    preHandler: app.authorize(policy.contexts!.get),
    handler: async ({ params, req }) => {
      const ps = z.object({ id: z.string().min(1) }).parse(params);
      const ctx = await db.context.findUnique({ where: { id: ps.id } });
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'contexts.get', success: Boolean(ctx), contextId: params.id, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return ctx ?? { error: 'Not found' };
    },
  });

  app.route({
    method: 'PUT',
    path: '/contexts/:id',
    preHandler: app.authorize(policy.contexts!.update),
    handler: async ({ params, body, req }) => {
      const ps = z.object({ id: z.string().min(1) }).parse(params);
      const schema = z.object({ type: z.string().min(1).optional(), parentId: z.string().min(1).nullable().optional() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { type, parentId } = parsed.data;
      const ctx = await db.context.update({ where: { id: ps.id }, data: { type, parentId: parentId ?? null } });
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'contexts.update', success: true, contextId: params.id, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return ctx;
    },
  });

  app.route({
    method: 'DELETE',
    path: '/contexts/:id',
    preHandler: app.authorize(policy.contexts!.delete),
    handler: async ({ params, req }) => {
      const ps = z.object({ id: z.string().min(1) }).parse(params);
      const ok = await db.context.delete({ where: { id: ps.id } }).then(() => true).catch(() => false);
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'contexts.delete', success: ok, contextId: params.id, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/contexts/:id/users/add',
    preHandler: app.authorize(policy.contexts!.addUser),
    handler: async ({ params, body, req }) => {
      const ps = z.object({ id: z.string().min(1) }).parse(params);
      const schema = z.object({ userId: z.string().min(1) });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { userId } = parsed.data;
      const id = `${userId}-${ps.id}`;
      await db.userContext.upsert({ where: { id }, update: {}, create: { id, userId, contextId: ps.id } });
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'contexts.user.add', success: true, contextId: params.id, targetUserId: userId, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return { ok: true };
    },
  });

  app.route({
    method: 'POST',
    path: '/contexts/:id/users/remove',
    preHandler: app.authorize(policy.contexts!.removeUser),
    handler: async ({ params, body, req }) => {
      const ps = z.object({ id: z.string().min(1) }).parse(params);
      const schema = z.object({ userId: z.string().min(1) });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
      const { userId } = parsed.data;
      const id = `${userId}-${ps.id}`;
      const ok = await db.userContext.delete({ where: { id } }).then(() => true).catch(() => false);
      await app.auditService.log({ actorId: (req?.user?.id as string) ?? null, action: 'contexts.user.remove', success: ok, contextId: params.id, targetUserId: userId, requestId: req?.requestId, ip: req?.clientIp, userAgent: req?.userAgent });
      return { ok: true };
    },
  });
}


