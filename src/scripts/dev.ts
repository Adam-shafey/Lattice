import { Lattice } from '../index';
import { logger } from '../core/logger';

async function bootstrap() {
  const app = Lattice({
    db: { provider: 'sqlite' },
    adapter: (process.env.ADAPTER as 'fastify' | 'express') || 'fastify',
    jwt: { accessTTL: '15m', refreshTTL: '7d', secret: process.env.JWT_SECRET || 'dev-secret' },
    apiPrefix: '/api',
    exposeAPI: true,
  });

  app.route({
    method: 'GET',
    path: '/',
    handler: async () => ({ 
      message: 'Lattice Access Control System',
      admin: '/admin',
      api: app.apiBase || '/api',
      docs: '/docs',
      health: '/ping'
    }),
  });

  app.route({
    method: 'GET',
    path: '/ping',
    handler: async () => ({ pong: true }),
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  
  logger.log(`🚀 Lattice server running on http://localhost:${port}`);
  logger.log(`📊 Admin UI available at http://localhost:${port}/admin`);
  logger.log(`🔌 API available at http://localhost:${port}/api`);
  logger.log(`📚 API Documentation available at http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  logger.error(err);
  process.exit(1);
});


