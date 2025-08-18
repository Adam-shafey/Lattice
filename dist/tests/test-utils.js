"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupDatabase = cleanupDatabase;
async function cleanupDatabase(db) {
    // Delete in order of dependencies (most dependent first)
    await db.userPermission.deleteMany();
    await db.rolePermission.deleteMany();
    await db.userRole.deleteMany();
    await db.userContext.deleteMany();
    await db.revokedToken.deleteMany();
    await db.passwordResetToken.deleteMany();
    await db.auditLog.deleteMany();
    await db.user.deleteMany();
    await db.role.deleteMany();
    await db.permission.deleteMany();
    await db.context.deleteMany();
}
