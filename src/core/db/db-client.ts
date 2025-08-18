import { PrismaClient } from '../../../prisma/generated/client';
import { logger } from '../logger';

// Set the database URL if not already set - this must happen before PrismaClient instantiation
import path from 'path';
const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${dbPath}`;

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
export type { Prisma } from '../../../prisma/generated/client';

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
  PasswordResetToken
} from '../../../prisma/generated/client';