import { describe, it, expect, beforeAll } from 'vitest';
import { CoreSaaS } from '../index';
import { PrismaClient } from '@prisma/client';

let db: PrismaClient;

describe('effective permissions', () => {
  let app: ReturnType<typeof CoreSaaS>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    db = new PrismaClient();
    app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    await app.permissionRegistry.initFromDatabase();
    await app.permissionRegistry.syncToDatabase();
  });

  it('merges user and role permissions (global)', async () => {
    const user = await db.user.findUnique({ where: { email: 'admin@example.com' } });
    expect(user).toBeTruthy();
    const ok = await app.checkAccess({ userId: user!.id, permission: 'example:read' });
    expect(ok).toBe(true);
  });
});


