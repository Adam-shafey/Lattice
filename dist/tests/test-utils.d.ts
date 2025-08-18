import { PrismaClient } from '../../prisma/generated/client';
export declare function cleanupDatabase(db: PrismaClient): Promise<void>;
