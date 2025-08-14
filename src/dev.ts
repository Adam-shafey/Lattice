import { CoreSaaS } from './index';

async function bootstrap() {
  const app = CoreSaaS({
    db: { provider: 'sqlite' },
    adapter: (process.env.ADAPTER as 'fastify' | 'express') || 'fastify',
    jwt: { accessTTL: '15m', refreshTTL: '7d', secret: process.env.JWT_SECRET || 'dev-secret' },
  });

  app.route({
    method: 'GET',
    path: '/ping',
    handler: async () => ({ pong: true }),
  });

  app.route({
    method: 'GET',
    path: '/secure/:contextId/info',
    preHandler: [app.requireAuth(), app.authorize('example:read', { contextRequired: true })],
    handler: async ({ user, context }) => ({ user, context, ok: true }),
  });

  app.grantUserPermission('user_123', 'example:*', 'ctx_1');

  await app.listen(Number(process.env.PORT) || 3000);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


