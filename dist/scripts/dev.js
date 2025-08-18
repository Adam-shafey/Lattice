"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const logger_1 = require("../core/logger");
async function bootstrap() {
    const app = (0, index_1.Lattice)({
        db: { provider: 'sqlite' },
        adapter: process.env.ADAPTER || 'fastify',
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
    logger_1.logger.log(`🚀 Lattice server running on http://localhost:${port}`);
    logger_1.logger.log(`📊 Admin UI available at http://localhost:${port}/admin`);
    logger_1.logger.log(`🔌 API available at http://localhost:${port}/api`);
    logger_1.logger.log(`📚 API Documentation available at http://localhost:${port}/docs`);
}
bootstrap().catch((err) => {
    logger_1.logger.error(err);
    process.exit(1);
});
