"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
async function bootstrap() {
    const app = (0, index_1.CoreSaaS)({
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
    console.log(`🚀 Lattice server running on http://localhost:${port}`);
    console.log(`📊 Admin UI available at http://localhost:${port}/admin`);
    console.log(`🔌 API available at http://localhost:${port}/api`);
    console.log(`📚 API Documentation available at http://localhost:${port}/docs`);
}
bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
});
