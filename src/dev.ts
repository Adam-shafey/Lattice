import { CoreSaaS } from './index';
import path from 'path';
import express from 'express';

async function bootstrap() {
  const app = CoreSaaS({
    db: { provider: 'sqlite' },
    adapter: (process.env.ADAPTER as 'fastify' | 'express') || 'express',
    jwt: { accessTTL: '15m', refreshTTL: '7d', secret: process.env.JWT_SECRET || 'dev-secret' },
    apiPrefix: '/api',
  });

  app.route({
    method: 'GET',
    path: '/',
    handler: async () => ({ 
      message: 'Lattice Access Control System',
      admin: '/admin',
      api: app.apiBase || '/api',
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
  
  console.log(`🚀 Lattice server running on http://localhost:${port}`);
  console.log(`📊 Admin UI available at http://localhost:${port}/admin`);
  console.log(`🔌 API available at http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


