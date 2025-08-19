import { Lattice } from '../index';

async function main() {
  const app = Lattice({
    db: { provider: 'sqlite' },
    adapter: 'fastify',
    jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'dev-secret' },
    apiConfig: { authn: false, authz: false },
  });

  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port);
  console.log(`Policy manager running at http://localhost:${port}`);
}

main().catch((err) => {
  console.error('Failed to start policy manager', err);
  process.exit(1);
});
