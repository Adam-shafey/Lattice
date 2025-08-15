import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createJwtUtil } from '../core/auth/jwt';
import { CoreSaaS } from '../index';
import { db } from '../core/db/db-client';

describe('Auth Service', () => {
  let app: ReturnType<typeof CoreSaaS>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    app = CoreSaaS({ 
      db: { provider: 'sqlite' }, 
      adapter: 'fastify', 
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test-secret' }
    });
  });

  afterAll(async () => {
    await app.shutdown();
  });

  describe('JWT utilities', () => {
    it('signs and verifies access tokens', () => {
      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt.signAccess({ sub: 'user_1' });
      const payload = jwt.verify(token) as any;
      expect(payload.sub).toBe('user_1');
      expect(payload.type).toBe('access');
    });

    it('signs and verifies refresh tokens', () => {
      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt.signRefresh({ sub: 'user_1' });
      const payload = jwt.verify(token) as any;
      expect(payload.sub).toBe('user_1');
      expect(payload.type).toBe('refresh');
    });

    it('includes JTI in tokens', () => {
      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt.signAccess({ sub: 'user_1' });
      const payload = jwt.verify(token) as any;
      expect(payload.jti).toBeDefined();
      expect(typeof payload.jti).toBe('string');
    });

    it('rejects invalid tokens', () => {
      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      expect(() => jwt.verify('invalid-token')).toThrow();
    });

    it('rejects tokens with wrong secret', () => {
      const jwt1 = createJwtUtil({ secret: 'secret1', accessTTL: '15m', refreshTTL: '7d' });
      const jwt2 = createJwtUtil({ secret: 'secret2', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt1.signAccess({ sub: 'user_1' });
      expect(() => jwt2.verify(token)).toThrow();
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

      // Cleanup
      await app.userService.deleteUser(user.id, { actorId: 'system' });
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

      // Cleanup
      await app.userService.deleteUser(user.id, { actorId: 'system' });
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

      // Cleanup
      await app.userService.deleteUser(user.id, { actorId: 'system' });
    });
  });

  describe('Token revocation', () => {
    it('tracks revoked tokens', async () => {
      const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
      const token = jwt.signAccess({ sub: 'user_1' });
      const payload = jwt.verify(token) as any;
      const jti = payload.jti;

      // Revoke token
      await db.revokedToken.create({
        data: { jti, userId: 'user_1' }
      });

      // Verify token is now invalid
      expect(() => jwt.verify(token)).toThrow();
    });
  });
});


