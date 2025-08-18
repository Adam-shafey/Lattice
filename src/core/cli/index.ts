#!/usr/bin/env node
import minimist from 'minimist';
import { Lattice } from '../../index';
import { logger } from '../../core/logger';

function createApp() {
  return Lattice({
    db: { provider: 'sqlite' },
    adapter: 'fastify',
    jwt: { accessTTL: '15m', refreshTTL: '7d', secret: process.env.JWT_SECRET || 'dev-secret' }
  });
}

async function listPermissions(app: ReturnType<typeof Lattice>) {
  await app.permissionRegistry.initFromDatabase();
  const list = app.permissionRegistry.list();
  for (const p of list) {
    // eslint-disable-next-line no-console
    logger.log(`${p.key}${p.plugin ? ` [${p.plugin}]` : ''} - ${p.label}`);
  }
}

async function checkAccess(app: ReturnType<typeof Lattice>, argv: minimist.ParsedArgs) {
  const userId = String(argv.userId || argv.u || 'user_123');
  const contextId = (argv.contextId || argv.c) ? String(argv.contextId || argv.c) : undefined;
  const permission = String(argv.permission || argv.p || 'example:read');
  await app.permissionRegistry.initFromDatabase();
  await app.permissionService.grantToUser({
    userId,
    permissionKey: permission,
    contextId: contextId || null,
    context: { actorId: 'system' }
  });
  const ok = await app.checkAccess({ userId, context: contextId ? { id: contextId, type: 'unknown' } : null, permission });
  // eslint-disable-next-line no-console
  logger.log(ok ? 'ALLOWED' : 'DENIED');
}

async function main() {
  const app = createApp();
  const argv = minimist(process.argv.slice(2));
  const cmd = argv._[0];

  async function resolveUserIdFromArgs(): Promise<string> {
    const explicit = argv.userId || argv.u;
    if (explicit) return String(explicit);
    const email = argv.email || argv.e;
    if (!email) throw new Error('Provide --userId <id> or --email <email>');
    
    // Use the new UserService instead of direct database access
    const userService = app.userService;
    const user = await userService.getUserByEmail(String(email));
    if (!user) throw new Error(`User not found for email ${email}. Create it first with: lattice users:create --email <email> --password <pw>`);
    return user.id;
  }

  try {
  switch (cmd) {
    case 'list-permissions':
      await listPermissions(app);
      break;
    case 'check-access':
      await checkAccess(app, argv);
      break;
    case 'users:create': {
      const email = String(argv.email || argv.e);
      const password = String(argv.password || argv.p);
      if (!email || !password) throw new Error('Usage: users:create --email <email> --password <pw>');

      // Use the new UserService instead of direct database access
      const userService = app.userService;
      const user = await userService.createUser({
        email,
        password,
        context: { actorId: 'system' }
      });
      logger.log(user);
      break;
    }
    case 'users:list': {
      const userService = app.userService;
      const limit = argv.limit ? parseInt(String(argv.limit)) : 20;
      const offset = argv.offset ? parseInt(String(argv.offset)) : 0;
      
      const result = await userService.listUsers({
        limit,
        offset,
        context: { actorId: 'system' }
      });
      
      logger.log(`Found ${result.total} users:`);
      result.users.forEach(user => {
        logger.log(`- ${user.id}: ${user.email} (created: ${user.createdAt})`);
      });
      break;
    }
    case 'users:get': {
      const userService = app.userService;
      const email = argv.email || argv.e;
      const userId = argv.userId || argv.u;
      
      if (!email && !userId) {
        throw new Error('Provide --email <email> or --userId <id>');
      }
      
      let user;
      if (email) {
        user = await userService.getUserByEmail(String(email), { actorId: 'system' });
      } else {
        user = await userService.getUserById(String(userId), { actorId: 'system' });
      }
      
      if (!user) {
        logger.log('User not found');
      } else {
        logger.log(user);
      }
      break;
    }
    case 'users:delete': {
      const userService = app.userService;
      const userId = await resolveUserIdFromArgs();
      
      await userService.deleteUser(userId, { actorId: 'system' });
      logger.log('User deleted successfully');
      break;
    }
    case 'roles:create': {
      const roleService = app.roleService;
      const name = String(argv.name || argv.n);
      const contextType = String(argv.contextType || 'global');
      const key = argv.key ? String(argv.key) : undefined;
      
      const role = await roleService.createRole({
        name,
        contextType,
        key,
        context: { actorId: 'system' }
      });
      logger.log(role);
      break;
    }
    case 'roles:list': {
      const roleService = app.roleService;
      const contextType = argv.contextType ? String(argv.contextType) : undefined;
      
      const roles = await roleService.listRoles({ contextType });
      logger.log('Roles:');
      roles.forEach(role => {
        logger.log(`- ${role.name} (${role.key}) - ${role.contextType || 'global'}`);
      });
      break;
    }
    case 'roles:assign': {
      const roleService = app.roleService;
      const roleName = String(argv.role || argv.r);
      const userId = await resolveUserIdFromArgs();
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      const contextType = argv.contextType ? String(argv.contextType) : undefined;
      
      await roleService.assignRoleToUser({
        roleName,
        userId,
        contextId,
        contextType,
        context: { actorId: 'system' }
      });
      logger.log('Role assigned successfully');
      break;
    }
    case 'roles:remove': {
      const roleService = app.roleService;
      const roleName = String(argv.role || argv.r);
      const userId = await resolveUserIdFromArgs();
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      
      await roleService.removeRoleFromUser({
        roleName,
        userId,
        contextId,
        context: { actorId: 'system' }
      });
      logger.log('Role removed successfully');
      break;
    }
    case 'roles:add-perm': {
      const roleService = app.roleService;
      const roleName = String(argv.role || argv.r);
      const permissionKey = String(argv.permission || argv.p);
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      const contextType = argv.contextType ? String(argv.contextType) : undefined;
      
      await roleService.addPermissionToRole({
        roleName,
        permissionKey,
        contextId,
        contextType,
        context: { actorId: 'system' }
      });
      logger.log('Permission added to role successfully');
      break;
    }
    case 'roles:remove-perm': {
      const roleService = app.roleService;
      const roleName = String(argv.role || argv.r);
      const permissionKey = String(argv.permission || argv.p);
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      
      await roleService.removePermissionFromRole({
        roleName,
        permissionKey,
        contextId,
        context: { actorId: 'system' }
      });
      logger.log('Permission removed from role successfully');
      break;
    }
    case 'roles:user-roles': {
      const roleService = app.roleService;
      const userId = await resolveUserIdFromArgs();
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      
      const roles = await roleService.listUserRoles({
        userId,
        contextId,
        context: { actorId: 'system' }
      });
      
      logger.log('User roles:');
      roles.forEach(role => {
        logger.log(`- ${role.name}${role.contextId ? ` (context: ${role.contextId})` : ' (global)'}`);
      });
      break;
    }
    case 'permissions:grant': {
      const permissionService = app.permissionService;
      const userId = await resolveUserIdFromArgs();
      const permissionKey = String(argv.permission || argv.p);
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      const contextType = argv.contextType ? String(argv.contextType) : undefined;
      
      await permissionService.grantToUser({
        userId,
        permissionKey,
        contextId,
        contextType,
        context: { actorId: 'system' }
      });
      logger.log('Permission granted successfully');
      break;
    }
    case 'permissions:revoke': {
      const permissionService = app.permissionService;
      const userId = await resolveUserIdFromArgs();
      const permissionKey = String(argv.permission || argv.p);
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      
      await permissionService.revokeFromUser({
        userId,
        permissionKey,
        contextId,
        context: { actorId: 'system' }
      });
      logger.log('Permission revoked successfully');
      break;
    }
    case 'permissions:user': {
      const permissionService = app.permissionService;
      const userId = await resolveUserIdFromArgs();
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      const contextType = argv.contextType ? String(argv.contextType) : undefined;
      
      const permissions = await permissionService.getUserPermissions({
        userId,
        contextId,
        contextType,
        context: { actorId: 'system' }
      });
      
      logger.log('User permissions:');
      permissions.forEach(permission => {
        logger.log(`- ${permission.key}: ${permission.label}`);
      });
      break;
    }
    case 'permissions:effective': {
      const permissionService = app.permissionService;
      const userId = await resolveUserIdFromArgs();
      const contextId = argv.contextId ? String(argv.contextId) : undefined;
      
      const permissions = await permissionService.getUserEffectivePermissions({
        userId,
        contextId,
        context: { actorId: 'system' }
      });
      
      logger.log('Effective permissions:');
      permissions.forEach(permission => {
        logger.log(`- ${permission.key}: ${permission.label}`);
      });
      break;
    }
    case 'contexts:create': {
      const contextService = app.contextService;
      const id = String(argv.id);
      const type = String(argv.type);
      const name = String(argv.name);
      
      const context = await contextService.createContext({
        id,
        type,
        name,
        context: { actorId: 'system' }
      });
      logger.log(context);
      break;
    }
    case 'contexts:list': {
      const contextService = app.contextService;
      const type = argv.type ? String(argv.type) : undefined;
      const limit = argv.limit ? parseInt(String(argv.limit)) : 20;
      const offset = argv.offset ? parseInt(String(argv.offset)) : 0;
      
      const result = await contextService.listContexts({
        type,
        limit,
        offset
      });
      
      logger.log(`Found ${result.total} contexts:`);
      result.contexts.forEach(context => {
        logger.log(`- ${context.id}: ${context.name} (${context.type})`);
      });
      break;
    }
    case 'help':
    default:
      // eslint-disable-next-line no-console
      logger.log('Usage: lattice <command>');
      // eslint-disable-next-line no-console
      logger.log('Commands:');
      // eslint-disable-next-line no-console
      logger.log('  list-permissions');
      // eslint-disable-next-line no-console
      logger.log('  check-access --userId <id> --contextId <ctx?> --permission <perm>');
      logger.log('  users:create --email <email> --password <pw>');
      logger.log('  users:list [--limit <n>] [--offset <n>]');
      logger.log('  users:get (--email <email> | --userId <id>)');
      logger.log('  users:delete (--userId <id> | --email <email>)');
      logger.log('  roles:create --name <name> [--contextType <type>] [--key <key>]');
      logger.log('  roles:list [--contextType <type>]');
      logger.log('  roles:assign --role <name> (--userId <id> | --email <email>) [--contextId <ctx>] [--contextType <type>]');
      logger.log('  roles:remove --role <name> (--userId <id> | --email <email>) [--contextId <ctx>]');
      logger.log('  roles:add-perm --role <name> --permission <key> [--contextId <ctx>] [--contextType <type>]');
      logger.log('  roles:remove-perm --role <name> --permission <key> [--contextId <ctx>]');
      logger.log('  roles:user-roles (--userId <id> | --email <email>) [--contextId <ctx>]');
      logger.log('  permissions:grant --permission <key> (--userId <id> | --email <email>) [--contextId <ctx>] [--contextType <type>]');
      logger.log('  permissions:revoke --permission <key> (--userId <id> | --email <email>) [--contextId <ctx>]');
      logger.log('  permissions:user (--userId <id> | --email <email>) [--contextId <ctx>] [--contextType <type>]');
      logger.log('  permissions:effective (--userId <id> | --email <email>) [--contextId <ctx>]');
      logger.log('  contexts:create --id <id> --type <type> --name <name>');
      logger.log('  contexts:list [--type <type>] [--limit <n>] [--offset <n>]');
  }
  } finally {
    await app.shutdown();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  logger.error(err);
  process.exit(1);
});


