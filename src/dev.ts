import { CoreSaaS } from './index';
import path from 'path';
import express from 'express';

async function bootstrap() {
  const app = CoreSaaS({
    db: { provider: 'sqlite' },
    adapter: (process.env.ADAPTER as 'fastify' | 'express') || 'express',
    jwt: { accessTTL: '15m', refreshTTL: '7d', secret: process.env.JWT_SECRET || 'dev-secret' },
  });

  // Get the underlying Express app for static file serving
  const expressApp = app.express;
  if (expressApp) {
    // Serve static files from the built AccessControlUI
    const adminUIPath = path.join(__dirname, '../AccessControlUI/dist');
    expressApp.use('/admin', express.static(adminUIPath));
    
    // Serve the admin UI for all /admin routes (SPA routing)
    expressApp.get('/admin/*', (req, res) => {
      res.sendFile(path.join(adminUIPath, 'index.html'));
    });
  }

  app.route({
    method: 'GET',
    path: '/',
    handler: async () => ({ 
      message: 'Lattice Access Control System',
      admin: '/admin',
      api: '/api',
      health: '/ping'
    }),
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

  await app.permissionService.grantToUser({
    userId: 'user_123',
    permissionKey: 'example:*',
    contextId: 'ctx_1',
    context: { actorId: 'system' }
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  
  console.log(`🚀 Lattice server running on http://localhost:${port}`);
  console.log(`📊 Admin UI available at http://localhost:${port}/admin`);
  console.log(`🔌 API available at http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


