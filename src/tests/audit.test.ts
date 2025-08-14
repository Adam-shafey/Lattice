import { describe, it, expect, beforeAll } from 'vitest';
import { CoreSaaS } from '../index';
import { PrismaClient } from '@prisma/client';

describe('audit logging toggle', () => {
  const db = new PrismaClient();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  });

  it('logs when enabled', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }, audit: { enabled: true } });
    const before = await db.auditLog.count();
    await app.auditService.log({ action: 'test.event', success: true, actorId: null, contextId: null });
    const after = await db.auditLog.count();
    expect(after).toBe(before + 1);
  });

  it('does not log when disabled', async () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }, audit: { enabled: false } });
    const before = await db.auditLog.count();
    await app.auditService.log({ action: 'test.event', success: true, actorId: null, contextId: null });
    const after = await db.auditLog.count();
    expect(after).toBe(before);
  });
});


