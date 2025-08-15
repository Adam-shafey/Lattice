import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CoreSaaS } from '../index';
import { db } from '../core/db/db-client';

describe('Audit Service', () => {
  let app: ReturnType<typeof CoreSaaS>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    app = CoreSaaS({ 
      db: { provider: 'sqlite' }, 
      adapter: 'fastify', 
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }, 
      audit: { enabled: true } 
    });
    
    // Clean up audit logs before tests
    await db.auditLog.deleteMany();
  });

  afterAll(async () => {
    await app.shutdown();
  });

  describe('audit logging toggle', () => {
    it('logs when enabled', async () => {
      const before = await db.auditLog.count();
      
      await app.auditService.log({ 
        action: 'test.event', 
        success: true, 
        actorId: 'test-user'
      });
      
      const after = await db.auditLog.count();
      expect(after).toBe(before + 1);
    });

    it('does not log when disabled', async () => {
      const disabledApp = CoreSaaS({ 
        db: { provider: 'sqlite' }, 
        adapter: 'fastify', 
        jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' }, 
        audit: { enabled: false } 
      });
      
      const before = await db.auditLog.count();
      
      await disabledApp.auditService.log({ 
        action: 'test.event', 
        success: true, 
        actorId: 'test-user'
      });
      
      const after = await db.auditLog.count();
      expect(after).toBe(before);
      
      await disabledApp.shutdown();
    });
  });

  describe('audit service methods', () => {
    it('logs permission checks', async () => {
      const before = await db.auditLog.count();
      
      await app.auditService.logPermissionCheck(
        'test-user', 
        'test-context', 
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
      expect(log?.actorId).toBe('test-user');
      expect(log?.contextId).toBe('test-context');
      expect(log?.success).toBe(true);
    });

    it('logs user actions', async () => {
      const before = await db.auditLog.count();
      
      await app.auditService.logUserAction(
        'admin-user', 
        'target-user', 
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
      expect(log?.actorId).toBe('admin-user');
      expect(log?.targetUserId).toBe('target-user');
      expect(log?.success).toBe(true);
    });

    it('logs token operations', async () => {
      const before = await db.auditLog.count();
      
      await app.auditService.logTokenIssued('test-user', 'access');
      await app.auditService.logTokenRevoked('test-user', 'refresh');
      
      const after = await db.auditLog.count();
      expect(after).toBe(before + 2);
    });

    it('redacts sensitive data', async () => {
      await app.auditService.log({
        action: 'test.sensitive',
        success: true,
        actorId: 'test-user',
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
      // Create some test logs
      await app.auditService.log({
        action: 'test.query1',
        success: true,
        actorId: 'user1',
        contextId: 'ctx1'
      });
      
      await app.auditService.log({
        action: 'test.query2',
        success: false,
        actorId: 'user2',
        contextId: 'ctx1'
      });
      
      const result = await app.auditService.getAuditLogs({
        actorId: 'user1',
        contextId: 'ctx1',
        limit: 10,
        offset: 0
      });
      
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs.every((log: any) => log.actorId === 'user1')).toBe(true);
      expect(result.logs.every((log: any) => log.contextId === 'ctx1')).toBe(true);
    });
  });
});


