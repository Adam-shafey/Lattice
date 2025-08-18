import { PrismaClient } from '../../../prisma/generated/client';
import { logger } from '../logger';

// Ensure database URL is explicitly provided
if (!process.env.DATABASE_URL) {
  const msg = 'DATABASE_URL environment variable is required but was not provided';
  logger.error(msg);
  throw new Error(msg);
}

/**
 * Singleton instance of PrismaClient for application use.
 * Note: For tests, create new PrismaClient instances directly to ensure test isolation.
 */
logger.log('🗄️ [DB_CLIENT] Initializing PrismaClient');
const prisma = new PrismaClient();

/**
 * Returns the singleton database client instance.
 * Note: For tests, create new PrismaClient instances directly instead of using this.
 */
export function getDbClient() {
  return prisma;
}

export { prisma as db };
export type { Prisma, PrismaClient } from '../../../prisma/generated/client';

// Export types from Prisma schema
export type {
  User,
  Role,
  Permission,
  UserRole,
  RolePermission,
  UserPermission,
  Context,
  UserContext,
  RevokedToken,
  AbacPolicy
} from '../../../prisma/generated/client';
