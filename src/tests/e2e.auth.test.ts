import { describe, it, expect, beforeAll } from 'vitest';
import { CoreSaaS } from '../index';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createAuthRoutes } from '../core/http/api/auth';

describe('E2E: auth login/refresh', () => {
  const db = new PrismaClient();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  });

  it('logs in with password and refreshes tokens', async () => {
    const email = `e2e_${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('secret', 10);
    const user = await db.user.create({ data: { email, passwordHash } });

    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    createAuthRoutes(app);
    const f = app.fastify!;

    const loginRes = await f.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'secret' } });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json() as any;
    expect(typeof loginBody.accessToken).toBe('string');
    expect(typeof loginBody.refreshToken).toBe('string');

    const refreshRes = await f.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: loginBody.refreshToken } });
    expect(refreshRes.statusCode).toBe(200);
    const refreshBody = refreshRes.json() as any;
    expect(typeof refreshBody.accessToken).toBe('string');
    expect(typeof refreshBody.refreshToken).toBe('string');

    // cleanup
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
  });
});


