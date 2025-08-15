import { describe, it, expect, beforeAll } from 'vitest';
import { CoreSaaS } from '../index';
import { PrismaClient } from '../../prisma/generated/client';

let db: PrismaClient & {
  user: {
    create: any;
    findUnique: any;
  };
  permission: {
    create: any;
  };
  userPermission: {
    create: any;
  };
};

describe('effective permissions', () => {
  let app: ReturnType<typeof CoreSaaS>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    db = new PrismaClient();
    app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    await app.permissionRegistry.initFromDatabase();
    await app.permissionRegistry.syncToDatabase();

    // Create test data
    const perm = await db.permission.upsert({
      where: { key: 'example:read' },
      update: { label: 'Read example' },
      create: {
        key: 'example:read',
        label: 'Read example'
      }
    });

    await db.user.create({
      data: {
        id: 'admin',
        email: 'admin@example.com',
        passwordHash: 'x'
      }
    });

    await db.userPermission.create({
      data: {
        id: 'admin-example-read',
        userId: 'admin',
        permissionId: perm.id,
        contextId: null,
        contextType: null
      }
    });
  });

  it('merges user and role permissions (global)', async () => {
    const user = await db.user.findUnique({ where: { email: 'admin@example.com' } });
    expect(user).toBeTruthy();
    const ok = await app.checkAccess({ userId: user!.id, permission: 'example:read' });
    expect(ok).toBe(true);
  });
});


