import { describe, it, expect, beforeAll } from 'vitest';
import { Lattice } from '../index';

describe('Lattice default configuration', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  });

  it('allows instantiation without config and exposes API routes by default', async () => {
    const app = Lattice();
    await app.listen(0);
    const res = await app.fastify!.inject({ method: 'POST', url: '/auth/login', payload: {} });
    expect(res.statusCode).toBe(200);
    await app.fastify!.close();
    await app.shutdown();
  });
});
