import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  // Seed default permissions
  const permissions = [
    { key: 'example:read', label: 'Read example' },
    { key: 'example:write', label: 'Write example' },
  ];
  for (const p of permissions) {
    await db.permission.upsert({ where: { key: p.key }, update: {}, create: { key: p.key, label: p.label } });
  }

  // Seed a role
  const role = await db.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } });
  const readPerm = await db.permission.findUniqueOrThrow({ where: { key: 'example:read' } });
  const writePerm = await db.permission.findUniqueOrThrow({ where: { key: 'example:write' } });
  const rp1Id = `${role.id}-${readPerm.id}-global`;
  const rp2Id = `${role.id}-${writePerm.id}-global`;
  await db.rolePermission.upsert({ where: { id: rp1Id }, update: {}, create: { id: rp1Id, roleId: role.id, permissionId: readPerm.id, contextId: null } });
  await db.rolePermission.upsert({ where: { id: rp2Id }, update: {}, create: { id: rp2Id, roleId: role.id, permissionId: writePerm.id, contextId: null } });

  // Seed a user
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await db.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', passwordHash },
  });
  await db.userRole.upsert({
    where: { id: `${user.id}-${role.id}-global` },
    update: {},
    create: { id: `${user.id}-${role.id}-global`, userId: user.id, roleId: role.id, contextId: null },
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


