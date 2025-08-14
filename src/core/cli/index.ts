#!/usr/bin/env node
import minimist from 'minimist';
import { CoreSaaS } from '../../index';
import { RoleService } from '../roles/role-service';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

function getApp() {
  const app = CoreSaaS({
    db: { provider: 'sqlite' },
    adapter: 'fastify',
    jwt: { accessTTL: '15m', refreshTTL: '7d', secret: process.env.JWT_SECRET || 'dev-secret' },
  });
  return app;
}

async function listPermissions() {
  const app = getApp();
  await app.permissionRegistry.initFromDatabase();
  const list = app.permissionRegistry.list();
  for (const p of list) {
    // eslint-disable-next-line no-console
    console.log(`${p.key}${p.plugin ? ` [${p.plugin}]` : ''} - ${p.label}`);
  }
}

async function checkAccess(argv: minimist.ParsedArgs) {
  const userId = String(argv.userId || argv.u || 'user_123');
  const contextId = (argv.contextId || argv.c) ? String(argv.contextId || argv.c) : undefined;
  const permission = String(argv.permission || argv.p || 'example:read');
  const app = getApp();
  await app.permissionRegistry.initFromDatabase();
  app.grantUserPermission(userId, permission, contextId);
  const ok = await app.checkAccess({ userId, context: contextId ? { id: contextId, type: 'unknown' } : null, permission });
  // eslint-disable-next-line no-console
  console.log(ok ? 'ALLOWED' : 'DENIED');
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  const cmd = argv._[0];

  async function resolveUserIdFromArgs(): Promise<string> {
    const explicit = argv.userId || argv.u;
    if (explicit) return String(explicit);
    const email = argv.email || argv.e;
    if (!email) throw new Error('Provide --userId <id> or --email <email>');
    const db = new PrismaClient();
    const user = await db.user.findUnique({ where: { email: String(email) } });
    if (!user) throw new Error(`User not found for email ${email}. Create it first with: lattice users:create --email <email> --password <pw>`);
    return user.id;
  }
  switch (cmd) {
    case 'list-permissions':
      await listPermissions();
      break;
    case 'check-access':
      await checkAccess(argv);
      break;
    case 'users:create': {
      const email = String(argv.email || argv.e);
      const password = String(argv.password || argv.p);
      if (!email || !password) throw new Error('Usage: users:create --email <email> --password <pw>');
      const db = new PrismaClient();
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await db.user.upsert({ where: { email }, update: {}, create: { email, passwordHash } });
      console.log(user);
      break;
    }
    case 'roles:create': {
      const rs = new RoleService();
      const name = String(argv.name || argv.n);
      const role = await rs.createRole(name);
      console.log(role);
      break;
    }
    case 'roles:list': {
      const rs = new RoleService();
      console.log(await rs.listRoles());
      break;
    }
    case 'roles:assign': {
      const rs = new RoleService();
      const roleName = String(argv.role || argv.r);
      const userId = await resolveUserIdFromArgs();
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      await rs.assignRoleToUser({ roleName, userId, contextId });
      console.log('OK');
      break;
    }
    case 'roles:remove': {
      const rs = new RoleService();
      const roleName = String(argv.role || argv.r);
      const userId = await resolveUserIdFromArgs();
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      await rs.removeRoleFromUser({ roleName, userId, contextId });
      console.log('OK');
      break;
    }
    case 'roles:add-perm': {
      const rs = new RoleService();
      const roleName = String(argv.role || argv.r);
      const permissionKey = String(argv.permission || argv.p);
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      await rs.addPermissionToRole({ roleName, permissionKey, contextId });
      console.log('OK');
      break;
    }
    case 'roles:remove-perm': {
      const rs = new RoleService();
      const roleName = String(argv.role || argv.r);
      const permissionKey = String(argv.permission || argv.p);
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      await rs.removePermissionFromRole({ roleName, permissionKey, contextId });
      console.log('OK');
      break;
    }
    case 'roles:user-roles': {
      const rs = new RoleService();
      const userId = await resolveUserIdFromArgs();
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      console.log(await rs.listUserRoles({ userId, contextId }));
      break;
    }
    case 'help':
    default:
      // eslint-disable-next-line no-console
      console.log('Usage: lattice <command>');
      // eslint-disable-next-line no-console
      console.log('Commands:');
      // eslint-disable-next-line no-console
      console.log('  list-permissions');
      // eslint-disable-next-line no-console
      console.log('  check-access --userId <id> --contextId <ctx?> --permission <perm>');
      console.log('  users:create --email <email> --password <pw>');
      console.log('  roles:create --name <name>');
      console.log('  roles:list');
      console.log('  roles:assign --role <name> (--userId <id> | --email <email>) [--contextId <ctx>]');
      console.log('  roles:remove --role <name> (--userId <id> | --email <email>) [--contextId <ctx>]');
      console.log('  roles:add-perm --role <name> --permission <key> [--contextId <ctx>]');
      console.log('  roles:remove-perm --role <name> --permission <key> [--contextId <ctx>]');
      console.log('  roles:user-roles (--userId <id> | --email <email>) [--contextId <ctx>]');
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


