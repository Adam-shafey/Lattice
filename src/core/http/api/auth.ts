import { LatticeCore } from '../../../index';
import { createJwtUtil } from '../../auth/jwt';
import { z } from 'zod';
import { db } from '../../db/db-client';
import { logger } from '../../logger';

function getJwt(app: LatticeCore) {
  const secret = app.jwtConfig?.secret || process.env.JWT_SECRET || 'dev-secret';
  const accessTTL = app.jwtConfig?.accessTTL || '15m';
  const refreshTTL = app.jwtConfig?.refreshTTL || '7d';
  return createJwtUtil({ secret, accessTTL, refreshTTL });
}

export function requireAuthMiddleware(app: LatticeCore) {
  return async function (req: any, res: any, next?: (err?: any) => void) {
    logger.log('🔑 [REQUIRE_AUTH] ===== REQUIRE AUTH MIDDLEWARE CALLED =====');
    logger.log('🔑 [REQUIRE_AUTH] Request headers:', req?.headers);
    
    try {
      const auth = req?.headers?.authorization as string | undefined;
      logger.log('🔑 [REQUIRE_AUTH] Authorization header:', auth);
      
      if (!auth || !auth.startsWith('Bearer ')) {
        logger.log('🔑 [REQUIRE_AUTH] ❌ No Bearer token found');
        const err = { statusCode: 401, message: 'Unauthorized' };
        if (res?.sent) return;
        if (res?.status) return res.status(401).send(err);
        if (res?.code) return res.code(401).send(err);
        if (next) return next(err);
        return;
      }
      
      const token = auth.substring('Bearer '.length);
      logger.log('🔑 [REQUIRE_AUTH] Token extracted:', token.substring(0, 20) + '...');
      
      const jwt = getJwt(app);
      const payload = await jwt.verify(token);
      logger.log('🔑 [REQUIRE_AUTH] JWT payload:', payload);
      (req as any).user = { id: payload.sub };
      logger.log('🔑 [REQUIRE_AUTH] ✅ Set req.user to:', req.user);
      
      if (next) return next();
    } catch (e) {
      logger.error('🔑 [REQUIRE_AUTH] ❌ Error during auth:', e);
      const err = { statusCode: 401, message: 'Unauthorized' };
      if (res?.sent) return;
      if (res?.status) return res.status(401).send(err);
      if (res?.code) return res.code(401).send(err);
      if (next) return next(err);
      return; // Don't continue to handler
    }
  };
}

export function createAuthRoutes(app: LatticeCore, prefix: string = '') {
  const jwt = getJwt(app);

  const p = prefix;

  app.route({
    method: 'POST',
    path: `${p}/auth/login`,
    handler: async ({ body }) => {
      const schema = z.object({
        email: z.string().email(),
        // Require passwords to be at least 8 characters
        password: z.string().min(8)
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
        
        return { accessToken: access, refreshToken: refresh };
      } catch (error: any) {
        return { error: error.message || 'Login failed' };
      }
    },
  });

  app.route({
    method: 'POST',
    path: `${p}/auth/refresh`,
    handler: async ({ body }) => {
      const schema = z.object({ 
        refreshToken: z.string().min(1) 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { refreshToken } = parsed.data;
        const payload = jwt.verifyWithoutRevocationCheck(refreshToken);
        const userId = payload.sub;
        const jti = payload.jti;
        
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
        }
        
        // Generate new tokens
        const access = jwt.signAccess({ sub: user.id });
        const newRefresh = jwt.signRefresh({ sub: user.id });
        
        return { accessToken: access, refreshToken: newRefresh };
      } catch (error: any) {
        return { error: error.message || 'Token refresh failed' };
      }
    },
  });

  // Explicit revocation endpoint
  app.route({
    method: 'POST',
    path: `${p}/auth/revoke`,
    handler: async ({ body }) => {
      const schema = z.object({ 
        token: z.string().min(1) 
      });
      
      try {
        const parsed = schema.safeParse(body);
        if (!parsed.success) return { error: 'Invalid input', issues: parsed.error.issues };
        
        const { token } = parsed.data;
        const payload = jwt.verifyWithoutRevocationCheck(token);
        const jti = payload.jti;
        
        if (!jti) return { ok: true };
        
        // Revoke token
        const revokedToken = await db.revokedToken.upsert({ 
          where: { jti }, 
          update: {}, 
          create: { jti, userId: payload?.sub ?? null } 
        });
        
        return { ok: true };
      } catch (error: any) {
        return { error: error.message || 'Token revocation failed' };
      }
    },
  });

  // Password change (requires auth)
  app.route({
    method: 'POST',
    path: `${p}/auth/password/change`,
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

}


