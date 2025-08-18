"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
async function main() {
    const app = (0, index_1.Lattice)({
        db: { provider: 'sqlite' },
        adapter: 'fastify',
        jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'dev-secret' },
        authn: false,
        authz: false,
    });
    const port = parseInt(process.env.PORT || '3001', 10);
    await app.listen(port);
    console.log(`Policy manager running at http://localhost:${port}`);
}
main().catch((err) => {
    console.error('Failed to start policy manager', err);
    process.exit(1);
});
