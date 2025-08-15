import { CoreSaaSApp } from '../../../index';
import { createJwtUtil } from '../../auth/jwt';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '../../db/db-client';

function getJwt() {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return createJwtUtil({ secret, accessTTL: '15m', refreshTTL: '7d' });
}

export function requireAuthMiddleware(app: CoreSaaSApp) {
  return async function (req: any, res: any, next?: (err?: any) => void) {
    try {
      const auth = req?.headers?.authorization as string | undefined;
      if (!auth || !auth.startsWith('Bearer ')) {
        const err = { statusCode: 401, message: 'Unauthorized' };
        if (res?.status) return res.status(401).send(err);
        if (res?.code) return res.code(401).send(err);
        if (next) return next(err);
        return;
      }
      const token = auth.substring('Bearer '.length);
      const jwt = getJwt();
      const payload = await jwt.verify(token) as any;
      (req as any).user = { id: payload.sub };
      if (next) return next();
    } catch (e) {
      const err = { statusCode: 401, message: 'Unauthorized' };
      if (res?.status) return res.status(401).send(err);
      if (res?.code) return res.code(401).send(err);
      if (next) return next(err);
      return; // Don't continue to handler
    }
  };
}

export function createAuthRoutes(app: CoreSaaSApp) {
  const jwt = getJwt();

  app.route({
    method: 'POST',
    path: '/auth/login',
    handler: async ({ body }) => {
      const schema = z.object({ 
        email: z.string().email(), 
        password: z.string().min(6) 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { email, password } = parsed.data;
        
        // Get user by email
        const user = await app.userService.getUserByEmail(email);
        if (!user) return { error: 'Invalid credentials' };
        
        // Verify password
        const isValid = await app.userService.verifyPassword(user.id, password);
        if (!isValid) return { error: 'Invalid credentials' };
        
        // Generate tokens
        const access = jwt.signAccess({ sub: user.id });
        const refresh = jwt.signRefresh({ sub: user.id });
        
        // Log token issuance
        await app.auditService.logTokenIssued(user.id, 'access');
        await app.auditService.logTokenIssued(user.id, 'refresh');
        
        return { accessToken: access, refreshToken: refresh };
      } catch (error: any) {
        return { error: error.message || 'Login failed' };
      }
    },
  });

  app.route({
    method: 'POST',
    path: '/auth/refresh',
    handler: async ({ body }) => {
      const schema = z.object({ 
        refreshToken: z.string().min(1) 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { refreshToken } = parsed.data;
        const payload = await jwt.verify(refreshToken) as any;
        const userId = payload?.sub as string | undefined;
        const jti = payload?.jti as string | undefined;
        
        if (!userId) return { error: 'Invalid token' };
        
        // Verify user exists
        const user = await app.userService.getUserById(userId);
        if (!user) return { error: 'Invalid token' };
        
        // Revoke old refresh token if JTI present
        if (jti) {
          await db.revokedToken.upsert({ 
            where: { jti }, 
            update: {}, 
            create: { jti, userId } 
          });
          await app.auditService.logTokenRevoked(userId, 'refresh');
        }
        
        // Generate new tokens
        const access = jwt.signAccess({ sub: user.id });
        const newRefresh = jwt.signRefresh({ sub: user.id });
        
        // Log token issuance
        await app.auditService.logTokenIssued(user.id, 'access');
        await app.auditService.logTokenIssued(user.id, 'refresh');
        
        return { accessToken: access, refreshToken: newRefresh };
      } catch (error: any) {
        return { error: error.message || 'Token refresh failed' };
      }
    },
  });

  // Explicit revocation endpoint
  app.route({
    method: 'POST',
    path: '/auth/revoke',
    handler: async ({ body }) => {
      const schema = z.object({ 
        token: z.string().min(1) 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { token } = parsed.data;
        const payload = jwt.verify(token) as any;
        const jti = payload?.jti as string | undefined;
        
        if (!jti) return { ok: true };
        
        // Revoke token
        await db.revokedToken.upsert({ 
          where: { jti }, 
          update: {}, 
          create: { jti, userId: payload?.sub ?? null } 
        });
        
        await app.auditService.logTokenRevoked(payload?.sub ?? 'unknown', 'access');
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Token revocation failed' };
      }
    },
  });

  // Password change (requires auth)
  app.route({
    method: 'POST',
    path: '/auth/password/change',
    preHandler: requireAuthMiddleware(app),
    handler: async ({ body, user }) => {
      const schema = z.object({ 
        oldPassword: z.string().min(6), 
        newPassword: z.string().min(6) 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { oldPassword, newPassword } = parsed.data;
        
        if (!user) {
          return { error: 'Unauthorized' };
        }
        
        await app.userService.changePassword(user.id, oldPassword, newPassword, {
          actorId: user.id
        });
        
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Password change failed' };
      }
    },
  });

  // Password reset request (by email)
  app.route({
    method: 'POST',
    path: '/auth/password/reset/request',
    handler: async ({ body }) => {
      const schema = z.object({ 
        email: z.string().email() 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { email } = parsed.data;
        
        // Check if user exists
        const user = await app.userService.getUserByEmail(email);
        if (!user) return { ok: true }; // Don't reveal if user exists
        
        // Generate reset token
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
        await db.passwordResetToken.create({ 
          data: { token, userId: user.id, expiresAt } 
        });
        
        // In real implementation, email the token. Here we return it for testability.
        return { ok: true, token };
      } catch (error: any) {
        return { error: error.message || 'Password reset request failed' };
      }
    },
  });

  // Password reset confirm
  app.route({
    method: 'POST',
    path: '/auth/password/reset/confirm',
    handler: async ({ body }) => {
      const schema = z.object({ 
        token: z.string().min(1), 
        newPassword: z.string().min(6) 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { token, newPassword } = parsed.data;
        
        // Find reset token
        const row = await db.passwordResetToken.findUnique({ where: { token } });
        
        if (!row || row.expiresAt < new Date()) {
          return { error: 'Invalid or expired token' };
        }
        
        // Update password
        await app.userService.updateUser(row.userId, { password: newPassword }, {
          actorId: 'system'
        });
        
        // Delete used token
        await db.passwordResetToken.delete({ where: { token } });
        
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Password reset confirmation failed' };
      }
    },
  });
}


