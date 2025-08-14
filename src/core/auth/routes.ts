import bcrypt from 'bcryptjs';
import { CoreSaaSApp } from '../../index';
import { getDbClient } from '../db/db-client';
import { createJwtUtil } from './jwt';

function getJwt() {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return createJwtUtil({ secret, accessTTL: '15m', refreshTTL: '7d' });
}

export function requireAuthMiddleware() {
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
      const payload = jwt.verify(token) as any;
      (req as any).user = { id: payload.sub };
      if (next) return next();
    } catch (e) {
      const err = { statusCode: 401, message: 'Unauthorized' };
      if (res?.status) return res.status(401).send(err);
      if (res?.code) return res.code(401).send(err);
      if (next) return next(err);
    }
  };
}

export function createAuthRoutes(app: CoreSaaSApp) {
  const db = getDbClient();
  const jwt = getJwt();

  app.route({
    method: 'POST',
    path: '/auth/login',
    handler: async ({ body }) => {
      const { email, password } = body as { email: string; password: string };
      const user = await db.user.findUnique({ where: { email } });
      if (!user) return { error: 'Invalid credentials' };
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return { error: 'Invalid credentials' };
      const access = jwt.signAccess({ sub: user.id });
      const refresh = jwt.signRefresh({ sub: user.id });
      await app.auditService.logTokenIssued(user.id, 'access');
      await app.auditService.logTokenIssued(user.id, 'refresh');
      return { accessToken: access, refreshToken: refresh };
    },
  });

  app.route({
    method: 'POST',
    path: '/auth/refresh',
    handler: async ({ body }) => {
      const { refreshToken } = body as { refreshToken: string };
      const payload = jwt.verify(refreshToken) as any;
      const userId = payload?.sub as string | undefined;
      if (!userId) return { error: 'Invalid token' };
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return { error: 'Invalid token' };
      const access = jwt.signAccess({ sub: user.id });
      const newRefresh = jwt.signRefresh({ sub: user.id });
      await app.auditService.logTokenIssued(user.id, 'access');
      await app.auditService.logTokenIssued(user.id, 'refresh');
      return { accessToken: access, refreshToken: newRefresh };
    },
  });
}


