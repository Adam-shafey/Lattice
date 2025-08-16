import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createJwtUtil } from '../core/auth/jwt';
import { CoreSaaS } from '../index';
import { db } from '../core/db/db-client';

describe('Auth Service', () => {
  let app: ReturnType<typeof CoreSaaS>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  });

  beforeEach(async () => {
    // Create fresh app instance for each test
    app = CoreSaaS({ 
      db: { provider: 'sqlite' }, 
      adapter: 'fastify', 
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test-secret' },
      audit: {
        enabled: false // Disable audit logging for tests
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

  describe('JWT utilities', () => {
    it('signs and verifies access tokens', async () => {
      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt.signAccess({ sub: 'user_1' });
      const payload = await jwt.verify(token) as any;
      expect(payload.sub).toBe('user_1');
      expect(payload.type).toBe('access');
    });

    it('signs and verifies refresh tokens', async () => {
      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt.signRefresh({ sub: 'user_1' });
      const payload = await jwt.verify(token) as any;
      expect(payload.sub).toBe('user_1');
      expect(payload.type).toBe('refresh');
    });

    it('includes JTI in tokens', async () => {
      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt.signAccess({ sub: 'user_1' });
      const payload = await jwt.verify(token) as any;
      expect(payload.jti).toBeDefined();
      expect(typeof payload.jti).toBe('string');
    });

    it('rejects invalid tokens', async () => {
      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      await expect(jwt.verify('invalid-token')).rejects.toThrow();
    });

    it('rejects tokens with wrong secret', async () => {
      const jwt1 = createJwtUtil({ secret: 'secret1', accessTTL: '15m', refreshTTL: '7d' });
      const jwt2 = createJwtUtil({ secret: 'secret2', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt1.signAccess({ sub: 'user_1' });
      await expect(jwt2.verify(token)).rejects.toThrow();
    });
  });

  describe('User authentication', () => {
    it('verifies user passwords', async () => {
      const user = await app.userService.createUser({
        email: 'test@example.com',
        password: 'securepassword123',
        context: { actorId: 'system' }
      });

      const isValid = await app.userService.verifyPassword(user.id, 'securepassword123');
      expect(isValid).toBe(true);

      const isInvalid = await app.userService.verifyPassword(user.id, 'wrongpassword');
      expect(isInvalid).toBe(false);

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles password changes', async () => {
      const user = await app.userService.createUser({
        email: 'test2@example.com',
        password: 'oldpassword123',
        context: { actorId: 'system' }
      });

      // Change password
      await app.userService.changePassword(
        user.id, 
        'oldpassword123', 
        'newpassword123',
        { actorId: user.id }
      );

      // Verify old password no longer works
      const oldValid = await app.userService.verifyPassword(user.id, 'oldpassword123');
      expect(oldValid).toBe(false);

      // Verify new password works
      const newValid = await app.userService.verifyPassword(user.id, 'newpassword123');
      expect(newValid).toBe(true);

      // No manual cleanup needed - beforeEach handles it
    });

    it('rejects password change with wrong old password', async () => {
      const user = await app.userService.createUser({
        email: 'test3@example.com',
        password: 'correctpassword123',
        context: { actorId: 'system' }
      });

      await expect(
        app.userService.changePassword(
          user.id, 
          'wrongpassword', 
          'newpassword123',
          { actorId: user.id }
        )
      ).rejects.toThrow();

      // Verify original password still works
      const stillValid = await app.userService.verifyPassword(user.id, 'correctpassword123');
      expect(stillValid).toBe(true);

      // No manual cleanup needed - beforeEach handles it
    });
  });

  describe('Token revocation', () => {
    it('tracks revoked tokens', async () => {
      // Create a real user first
      const user = await app.userService.createUser({
        email: 'revoke-test@example.com',
        password: 'password123',
        context: { actorId: 'system' }
      });

      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt.signAccess({ sub: user.id });
      const payload = await jwt.verify(token) as any;
      const jti = payload.jti;

      // Revoke token
      await db.revokedToken.create({
        data: { jti, userId: user.id }
      });

      // Verify token is now invalid
      await expect(jwt.verify(token)).rejects.toThrow('Token revoked');
    });
  });
});


