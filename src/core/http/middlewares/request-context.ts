import { randomUUID } from 'crypto';

export function requestContextMiddleware() {
  return function (req: any, res: any, next?: (err?: any) => void) {
    try {
      const requestId = req.headers['x-request-id'] || randomUUID();
      req.requestId = String(requestId);
      req.clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;
      req.userAgent = req.headers['user-agent'] || null;
      if (typeof next === 'function') next();
    } catch (err) {
      if (typeof next === 'function') next(err);
    }
  };
}


