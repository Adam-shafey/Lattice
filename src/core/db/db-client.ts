import { PrismaClient } from '@prisma/client';

let singleton: PrismaClient | null = null;

export function getDbClient(): PrismaClient {
  if (!singleton) {
    singleton = new PrismaClient();
  }
  return singleton;
}


