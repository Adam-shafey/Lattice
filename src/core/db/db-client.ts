import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export { prisma as db };
export type { Prisma, Role, UserRole, RolePermission, Context, Permission } from '@prisma/client';


