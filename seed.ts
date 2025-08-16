import { PrismaClient } from './prisma/generated/client';
import bcrypt from 'bcryptjs';

// Set the database URL if not already set
import path from 'path';
const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${dbPath}`;

const db = new PrismaClient();

async function main() {
  // Seed permissions used by the admin UI
  const permissions = [
    { key: '*', label: 'All permissions' },
    { key: 'users:*', label: 'User management' },
    { key: 'users:read', label: 'Read users' },
    { key: 'roles:*', label: 'Role management' },
    { key: 'permissions:*', label: 'Permission management' },
    { key: 'contexts:*', label: 'Context management' },
    { key: 'example:read', label: 'Read example' },
    { key: 'example:write', label: 'Write example' },
  ];

  for (const p of permissions) {
    await db.permission.upsert({
      where: { key: p.key },
      update: {},
      create: { key: p.key, label: p.label }
    });
  }

  // Seed a sample context
  await db.context.upsert({
    where: { id: 'org_1' },
    update: {},
    create: { id: 'org_1', type: 'org', name: 'Example Org' }
  });

  const passwordHash = await bcrypt.hash('password123', 10);

  // Super admin with all permissions
  const admin = await db.user.upsert({
    where: { id: 'user_admin' },
    update: {},
    create: { id: 'user_admin', email: 'admin@example.com', passwordHash }
  });
  const allPerm = await db.permission.findUniqueOrThrow({ where: { key: '*' } });
  await db.userPermission.upsert({
    where: { id: `${admin.id}-${allPerm.id}-global` },
    update: {},
    create: { id: `${admin.id}-${allPerm.id}-global`, userId: admin.id, permissionId: allPerm.id, contextId: null }
  });

  // Manager with user and role management
  const manager = await db.user.upsert({
    where: { id: 'user_manager' },
    update: {},
    create: { id: 'user_manager', email: 'manager@example.com', passwordHash }
  });
  const managerPerms = [
    await db.permission.findUniqueOrThrow({ where: { key: 'users:*' } }),
    await db.permission.findUniqueOrThrow({ where: { key: 'roles:*' } })
  ];
  for (const perm of managerPerms) {
    await db.userPermission.upsert({
      where: { id: `${manager.id}-${perm.id}-global` },
      update: {},
      create: { id: `${manager.id}-${perm.id}-global`, userId: manager.id, permissionId: perm.id, contextId: null }
    });
  }

  // Viewer with read-only access to users
  const viewer = await db.user.upsert({
    where: { id: 'user_viewer' },
    update: {},
    create: { id: 'user_viewer', email: 'viewer@example.com', passwordHash }
  });
  const readUsersPerm = await db.permission.findUniqueOrThrow({ where: { key: 'users:read' } });
  await db.userPermission.upsert({
    where: { id: `${viewer.id}-${readUsersPerm.id}-global` },
    update: {},
    create: {
      id: `${viewer.id}-${readUsersPerm.id}-global`,
      userId: viewer.id,
      permissionId: readUsersPerm.id,
      contextId: null
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });


