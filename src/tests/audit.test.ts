import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CoreSaaS } from '../index';
import { db } from '../core/db/db-client';

describe('Audit Service', () => {
  let app: ReturnType<typeof CoreSaaS>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  });

  beforeEach(async () => {
    // Create fresh app instance for each test
    app = CoreSaaS({ 
      db: { provider: 'sqlite' }, 
      adapter: 'fastify', 
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }, 
      audit: { 
        enabled: true,
        batchSize: 1, // Disable batching for tests
        flushInterval: 0, // Immediate flushing
        sinks: ['db'] // Only use database sink for tests
      } 
    });
    
    // Clean up database before each test - delete child records first
    await db.auditLog.deleteMany();
    await db.userPermission.deleteMany();
    await db.rolePermission.deleteMany();
    await db.userRole.deleteMany();
    await db.userContext.deleteMany();
    await db.passwordResetToken.deleteMany();
    await db.revokedToken.deleteMany();
    await db.user.deleteMany();
    await db.context.deleteMany();
    await db.role.deleteMany();
    await db.permission.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.shutdown();
    }
  });

  describe('audit logging toggle', () => {
    it('logs when enabled', async () => {
      // Create a test user for the audit log
      const user = await app.userService.createUser({
        email: 'test-user@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      const before = await db.auditLog.count();
      
      await app.auditService.log({ 
        action: 'test.event', 
        success: true, 
        actorId: user.id
      });
      
      const after = await db.auditLog.count();
      expect(after).toBe(before + 1);
    });

    it('does not log when disabled', async () => {
      const disabledApp = CoreSaaS({ 
        db: { provider: 'sqlite' }, 
        adapter: 'fastify', 
        jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }, 
        audit: { 
          enabled: false,
          batchSize: 1, // Disable batching for tests
          flushInterval: 0 // Immediate flushing
        } 
      });
      
      // Create a test user for the audit log
      const user = await disabledApp.userService.createUser({
        email: 'test-user-disabled@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });
      
      const before = await db.auditLog.count();
      
      await disabledApp.auditService.log({ 
        action: 'test.event', 
        success: true, 
        actorId: user.id
      });
      
      const after = await db.auditLog.count();
      expect(after).toBe(before);
      
      await disabledApp.shutdown();
    });
  });

  describe('audit service methods', () => {
    it('logs permission checks', async () => {
      // Create test user and context
      const user = await app.userService.createUser({
        email: 'test-user-perm@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      const context = await app.contextService.createContext({
        id: 'test-context',
        type: 'team',
        name: 'Test Context',
        context: { actorId: 'system' }
      });

      const before = await db.auditLog.count();
      
      await app.auditService.logPermissionCheck(
        user.id, 
        context.id, 
        'test:permission', 
        true
      );
      
      const after = await db.auditLog.count();
      expect(after).toBe(before + 1);
      
      const log = await db.auditLog.findFirst({
        where: { action: 'permission.check' },
        orderBy: { createdAt: 'desc' }
      });
      
      expect(log).toBeDefined();
      expect(log?.actorId).toBe(user.id);
      expect(log?.contextId).toBe(context.id);
      expect(log?.success).toBe(true);
    });

    it('logs user actions', async () => {
      // Create test users
      const adminUser = await app.userService.createUser({
        email: 'admin-user@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      const targetUser = await app.userService.createUser({
        email: 'target-user@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      const before = await db.auditLog.count();
      
      await app.auditService.logUserAction(
        adminUser.id, 
        targetUser.id, 
        'user.updated', 
        true
      );
      
      const after = await db.auditLog.count();
      expect(after).toBe(before + 1);
      
      const log = await db.auditLog.findFirst({
        where: { action: 'user.updated' },
        orderBy: { createdAt: 'desc' }
      });
      
      expect(log).toBeDefined();
      expect(log?.actorId).toBe(adminUser.id);
      expect(log?.targetUserId).toBe(targetUser.id);
      expect(log?.success).toBe(true);
    });

    it('logs token operations', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: 'test-user-token@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      const before = await db.auditLog.count();
      
      await app.auditService.logTokenIssued(user.id, 'access');
      await app.auditService.logTokenRevoked(user.id, 'refresh');
      
      const after = await db.auditLog.count();
      expect(after).toBe(before + 2);
    });

    it('redacts sensitive data', async () => {
      // Create test user
      const user = await app.userService.createUser({
        email: 'test-user-sensitive@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      await app.auditService.log({
        action: 'test.sensitive',
        success: true,
        actorId: user.id,
        metadata: {
          password: 'secret123',
          token: 'jwt-token',
          secret: 'api-key'
        }
      });

      const log = await db.auditLog.findFirst({
        where: { action: 'test.sensitive' },
        orderBy: { createdAt: 'desc' }
      });

      expect(log).toBeDefined();
      expect(log?.metadata).toEqual({
        password: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]'
      });
    });
  });

  describe('audit querying', () => {
    it('retrieves audit logs with filtering', async () => {
      // Create test user and context
      const user = await app.userService.createUser({
        email: 'user1@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      const context = await app.contextService.createContext({
        id: 'ctx1',
        type: 'team',
        name: 'Context 1',
        context: { actorId: 'system' }
      });

      // Create some audit logs
      await app.auditService.log({
        action: 'test.action1',
        success: true,
        actorId: user.id,
        contextId: context.id
      });

      await app.auditService.log({
        action: 'test.action2',
        success: true,
        actorId: user.id,
        contextId: context.id
      });

      const result = await app.auditService.getAuditLogs({
        actorId: user.id,
        contextId: context.id
      });

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs.every((log: any) => log.actorId === user.id)).toBe(true);
      expect(result.logs.every((log: any) => log.contextId === context.id)).toBe(true);
    });
  });
});


