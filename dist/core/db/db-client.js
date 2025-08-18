"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.getDbClient = getDbClient;
const client_1 = require("../../../prisma/generated/client");
const logger_1 = require("../logger");
// Ensure database URL is explicitly provided
if (!process.env.DATABASE_URL) {
    const msg = 'DATABASE_URL environment variable is required but was not provided';
    logger_1.logger.error(msg);
    throw new Error(msg);
}
/**
 * Singleton instance of PrismaClient for application use.
 * Note: For tests, create new PrismaClient instances directly to ensure test isolation.
 */
logger_1.logger.log('🗄️ [DB_CLIENT] Initializing PrismaClient');
const prisma = new client_1.PrismaClient();
exports.db = prisma;
/**
 * Returns the singleton database client instance.
 * Note: For tests, create new PrismaClient instances directly instead of using this.
 */
function getDbClient() {
    return prisma;
}
