import cluster from 'cluster';
import os from 'os';
import { Lattice } from '../index';
import { logger } from '../core/logger';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  const healthCheck = () => {
    for (const id in cluster.workers) {
      const worker = cluster.workers[id];
      if (!worker) continue;
      worker.send('ping');
      const timeout = setTimeout(() => {
        logger.error(`Worker ${worker.process.pid} failed health check`);
        worker.kill();
      }, 5000);
      worker.once('message', (msg) => {
        if (msg === 'pong') {
          clearTimeout(timeout);
        }
      });
    }
  };

  const interval = setInterval(healthCheck, 30000);

  const shutdown = () => {
    logger.log('Primary shutting down');
    clearInterval(interval);
    for (const id in cluster.workers) {
      cluster.workers[id]?.send('shutdown');
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  cluster.on('exit', (worker, code, signal) => {
    if (!worker.exitedAfterDisconnect) {
      logger.error(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
      cluster.fork();
    }
  });
} else {
  async function bootstrap() {
    const app = Lattice({
      db: { provider: 'sqlite' },
      adapter: (process.env.ADAPTER as 'fastify' | 'express') || 'fastify',
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: process.env.JWT_SECRET || 'dev-secret' },
      apiConfig: { apiPrefix: '/api' },
    });

    app.route({
      method: 'GET',
      path: '/',
      handler: async () => ({
        message: 'Lattice Access Control System',
        admin: '/admin',
        api: app.apiBase || '/api',
        docs: '/docs',
        health: '/ping',
      }),
    });

    app.route({
      method: 'GET',
      path: '/ping',
      handler: async () => ({ pong: true }),
    });

    const port = Number(process.env.PORT) || 3000;
    await app.listen(port);

    logger.log(`🚀 Worker ${process.pid} running on http://localhost:${port}`);
    logger.log(`📊 Admin UI available at http://localhost:${port}/admin`);
    logger.log(`🔌 API available at http://localhost:${port}${app.apiBase}`);
    logger.log(`📚 API Documentation available at http://localhost:${port}/docs`);

    const graceful = async () => {
      logger.log(`Graceful shutdown worker ${process.pid}`);
      await app.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', graceful);
    process.on('SIGTERM', graceful);
    process.on('message', async (msg) => {
      if (msg === 'shutdown') await graceful();
      if (msg === 'ping') process.send?.('pong');
    });
  }

  bootstrap().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}
