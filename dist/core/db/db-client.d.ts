import { PrismaClient } from '../../../prisma/generated/client';
declare const prisma: PrismaClient<import("../../../prisma/generated/client").Prisma.PrismaClientOptions, never, import("../../../prisma/generated/client/runtime/library").DefaultArgs>;
/**
 * Returns the singleton database client instance.
 * Note: For tests, create new PrismaClient instances directly instead of using this.
 */
export declare function getDbClient(): PrismaClient<import("../../../prisma/generated/client").Prisma.PrismaClientOptions, never, import("../../../prisma/generated/client/runtime/library").DefaultArgs>;
export { prisma as db };
export type { Prisma, PrismaClient } from '../../../prisma/generated/client';
export type { User, Role, Permission, UserRole, RolePermission, UserPermission, Context, UserContext, RevokedToken, AbacPolicy } from '../../../prisma/generated/client';
