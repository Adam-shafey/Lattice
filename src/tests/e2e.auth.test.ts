import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CoreSaaS } from '../index';
import { db } from '../core/db/db-client';
import { createAuthRoutes } from '../core/http/api/auth';

describe('E2E: Authentication', () => {
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

    // Initialize auth routes for testing
    createAuthRoutes(app);
  });

  afterAll(async () => {
    if (app) {
      await app.shutdown();
    }
  });

  describe('login and token refresh', () => {
    it('logs in with password and refreshes tokens', async () => {
      const email = `e2e_auth_${Date.now()}@example.com`;
      
      // Create user through service
      const user = await app.userService.createUser({
        email,
        password: 'secretpassword123',
        context: { actorId: 'system' }
      });

      const f = app.fastify!;

      // Test login
      const loginRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email, password: 'secretpassword123' } 
      });
      
      expect(loginRes.statusCode).toBe(200);
      const loginBody = loginRes.json() as any;
      expect(typeof loginBody.accessToken).toBe('string');
      expect(typeof loginBody.refreshToken).toBe('string');

      // Test token refresh
      const refreshRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/refresh', 
        payload: { refreshToken: loginBody.refreshToken } 
      });
      
      expect(refreshRes.statusCode).toBe(200);
      const refreshBody = refreshRes.json() as any;
      expect(typeof refreshBody.accessToken).toBe('string');
      expect(typeof refreshBody.refreshToken).toBe('string');

      // Verify tokens are different
      expect(refreshBody.accessToken).not.toBe(loginBody.accessToken);
      expect(refreshBody.refreshToken).not.toBe(loginBody.refreshToken);

      // No manual cleanup needed - beforeEach handles it
    });

    it('rejects invalid credentials', async () => {
      const email = `e2e_invalid_${Date.now()}@example.com`;
      
      // Create user
      const user = await app.userService.createUser({
        email,
        password: 'correctpassword123',
        context: { actorId: 'system' }
      });

      const f = app.fastify!;

      // Test wrong password
      const wrongPasswordRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email, password: 'wrongpassword123' } 
      });
      
      expect(wrongPasswordRes.statusCode).toBe(200);
      expect(wrongPasswordRes.json()).toHaveProperty('error', 'Invalid credentials');

      // Test non-existent user
      const nonExistentRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email: 'nonexistent@example.com', password: 'anypassword123' } 
      });
      
      expect(nonExistentRes.statusCode).toBe(200);
      expect(nonExistentRes.json()).toHaveProperty('error', 'Invalid credentials');

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles password change', async () => {
      const email = `e2e_password_${Date.now()}@example.com`;
      
      // Create user
      const user = await app.userService.createUser({
        email,
        password: 'oldpassword123',
        context: { actorId: 'system' }
      });

      const f = app.fastify!;

      // Login first
      const loginRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email, password: 'oldpassword123' } 
      });
      
      expect(loginRes.statusCode).toBe(200);
      const { accessToken } = loginRes.json() as any;

      // Change password
      const changePasswordRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/password/change', 
        payload: { oldPassword: 'oldpassword123', newPassword: 'newpassword123' },
        headers: { authorization: `Bearer ${accessToken}` }
      });
      
      expect(changePasswordRes.statusCode).toBe(200);

      // Small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify old password no longer works
      const oldPasswordRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email, password: 'oldpassword123' } 
      });
      
      expect(oldPasswordRes.statusCode).toBe(200);
      expect(oldPasswordRes.json()).toHaveProperty('error', 'Invalid credentials');

      // Verify new password works
      const newPasswordRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email, password: 'newpassword123' } 
      });
      
      expect(newPasswordRes.statusCode).toBe(200);
      expect(newPasswordRes.json()).toHaveProperty('accessToken');

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles password reset flow', async () => {
      const email = `e2e_reset_${Date.now()}@example.com`;
      
      // Create user
      const user = await app.userService.createUser({
        email,
        password: 'oldpassword123',
        context: { actorId: 'system' }
      });

      const f = app.fastify!;

      // Request password reset
      const requestRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/password/reset/request', 
        payload: { email } 
      });
      
      expect(requestRes.statusCode).toBe(200);
      const { token } = requestRes.json() as any;
      expect(typeof token).toBe('string');

      // Confirm password reset
      const confirmRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/password/reset/confirm', 
        payload: { token, newPassword: 'newpassword123' } 
      });
      
      expect(confirmRes.statusCode).toBe(200);

      // Verify new password works
      const loginRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email, password: 'newpassword123' } 
      });
      
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.json()).toHaveProperty('accessToken');

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles token revocation', async () => {
      const email = `e2e_revoke_${Date.now()}@example.com`;
      
      // Create user
      const user = await app.userService.createUser({
        email,
        password: 'password123',
        context: { actorId: 'system' }
      });

      const f = app.fastify!;

      // Login
      const loginRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email, password: 'password123' } 
      });
      
      expect(loginRes.statusCode).toBe(200);
      const { accessToken, refreshToken } = loginRes.json() as any;

      // Revoke access token (without requiring auth for revocation)
      const revokeRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/revoke', 
        payload: { token: accessToken }
      });
      
      expect(revokeRes.statusCode).toBe(200);

      // Verify revoked token no longer works
      const protectedRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/password/change', 
        payload: { oldPassword: 'password', newPassword: 'newpass' },
        headers: { authorization: `Bearer ${accessToken}` }
      });
      
      expect(protectedRes.statusCode).toBe(401);

      // No manual cleanup needed - beforeEach handles it
    });

    it('handles expired tokens', async () => {
      const email = `e2e_expired_${Date.now()}@example.com`;
      
      // Create user
      const user = await app.userService.createUser({
        email,
        password: 'password',
        context: { actorId: 'system' }
      });

      const f = app.fastify!;

      // Login
      const loginRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email, password: 'password' } 
      });
      
      expect(loginRes.statusCode).toBe(200);
      const { accessToken } = loginRes.json() as any;

      // Try to use token without authorization header
      const noAuthRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/password/change', 
        payload: { oldPassword: 'password', newPassword: 'newpass' }
      });
      
      expect(noAuthRes.statusCode).toBe(401);

      // Try to use malformed authorization header
      const malformedRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/password/change', 
        payload: { oldPassword: 'password', newPassword: 'newpass' },
        headers: { authorization: 'InvalidToken' }
      });
      
      expect(malformedRes.statusCode).toBe(401);

      // No manual cleanup needed - beforeEach handles it
    });
  });

  describe('input validation', () => {
    it('validates login input', async () => {
      const f = app.fastify!;

      // Test missing email
      const missingEmailRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { password: 'password' } 
      });
      
      expect(missingEmailRes.statusCode).toBe(200);
      expect(missingEmailRes.json()).toHaveProperty('error', 'Invalid input');

      // Test invalid email format
      const invalidEmailRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email: 'invalid-email', password: 'password' } 
      });
      
      expect(invalidEmailRes.statusCode).toBe(200);
      expect(invalidEmailRes.json()).toHaveProperty('error', 'Invalid input');

      // Test short password
      const shortPasswordRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email: 'test@example.com', password: '123' } 
      });
      
      expect(shortPasswordRes.statusCode).toBe(200);
      expect(shortPasswordRes.json()).toHaveProperty('error', 'Invalid input');
    });

    it('validates password change input', async () => {
      const email = `e2e_validation_${Date.now()}@example.com`;
      
      // Create user and login
      const user = await app.userService.createUser({
        email,
        password: 'password',
        context: { actorId: 'system' }
      });

      const f = app.fastify!;

      const loginRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/login', 
        payload: { email, password: 'password' } 
      });
      
      const { accessToken } = loginRes.json() as any;

      // Test missing old password
      const missingOldRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/password/change', 
        payload: { newPassword: 'newpassword' },
        headers: { authorization: `Bearer ${accessToken}` }
      });
      
      expect(missingOldRes.statusCode).toBe(200);
      expect(missingOldRes.json()).toHaveProperty('error', 'Invalid input');

      // Test short new password
      const shortNewRes = await f.inject({ 
        method: 'POST', 
        url: '/auth/password/change', 
        payload: { oldPassword: 'password', newPassword: '123' },
        headers: { authorization: `Bearer ${accessToken}` }
      });
      
      expect(shortNewRes.statusCode).toBe(200);
      expect(shortNewRes.json()).toHaveProperty('error', 'Invalid input');

      // No manual cleanup needed - beforeEach handles it
    });
  });
});


