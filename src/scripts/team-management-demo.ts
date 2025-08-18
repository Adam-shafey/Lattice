import { Lattice } from '../index';
import { logger } from '../core/logger';

/**
 * Example script demonstrating how to start a Lattice server
 * with team contexts, team management permissions and role
 * management.  This is meant as a quick onboarding reference
 * for developers.
 */
async function main() {
  // 1. Create an application instance. In this demo we use the
  // Fastify adapter with an in-memory SQLite database.
  const app = Lattice({
    db: { provider: 'sqlite' },
    adapter: 'fastify',
    jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'demo-secret' }
  });

  await app.listen(3000);
  logger.log('Lattice server running on http://localhost:3000');

  // 2. Register the permissions needed for team and role management.
  app.permissionRegistry.register({ key: 'roles:team:create', label: 'Create Team Roles' });
  app.permissionRegistry.register({ key: 'roles:assign:team', label: 'Assign Team Roles' });
  app.permissionRegistry.register({ key: 'roles:team:manage', label: 'Manage Team Roles' });
  app.permissionRegistry.register({ key: 'team:manage', label: 'Manage Team' });

  // 3. Create demo users.
  const superAdmin = await app.userService.createUser({
    email: 'super@example.com',
    password: 'password123',
    context: { actorId: 'system' }
  });

  const teamAdmin = await app.userService.createUser({
    email: 'admin@example.com',
    password: 'password123',
    context: { actorId: superAdmin.id }
  });

  const member = await app.userService.createUser({
    email: 'member@example.com',
    password: 'password123',
    context: { actorId: teamAdmin.id }
  });

  // 4. Give the super admin global role management ability.
  await app.permissionService.grantToUser({
    userId: superAdmin.id,
    permissionKey: '*', // wildcard gives access to all permissions
    context: { actorId: 'system' }
  });

  // 5. Create a team context.
  const team = await app.contextService.createContext({
    id: 'team_1',
    type: 'team',
    name: 'Demo Team',
    context: { actorId: superAdmin.id }
  });

  // 6. Super admin defines roles that can be used within teams.
  await app.roleService.createRole({
    name: 'team-admin',
    contextType: 'team',
    context: { actorId: superAdmin.id }
  });
  await app.roleService.createRole({
    name: 'team-member',
    contextType: 'team',
    context: { actorId: superAdmin.id }
  });

  // 7. Assign team-admin role to the teamAdmin user in the team.
  await app.roleService.assignRoleToUser({
    roleName: 'team-admin',
    userId: teamAdmin.id,
    contextId: team.id,
    contextType: 'team',
    context: { actorId: superAdmin.id }
  });

  // 8. Grant teamAdmin permission to manage the team and its roles.
  await app.permissionService.grantToUser({
    userId: teamAdmin.id,
    permissionKey: 'team:manage',
    contextId: team.id,
    contextType: 'team',
    context: { actorId: superAdmin.id }
  });
  await app.permissionService.grantToUser({
    userId: teamAdmin.id,
    permissionKey: 'roles:assign:team',
    contextId: team.id,
    contextType: 'team',
    context: { actorId: superAdmin.id }
  });

  // Add users to the team context.
  await app.contextService.addUserToContext({
    userId: teamAdmin.id,
    contextId: team.id,
    context: { actorId: superAdmin.id }
  });
  await app.contextService.addUserToContext({
    userId: member.id,
    contextId: team.id,
    context: { actorId: teamAdmin.id }
  });

  // 9. Team admin assigns the team-member role to the member.
  await app.roleService.assignRoleToUser({
    roleName: 'team-member',
    userId: member.id,
    contextId: team.id,
    contextType: 'team',
    context: { actorId: teamAdmin.id }
  });

  logger.log('Team setup complete. Press Ctrl+C to exit.');
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});

