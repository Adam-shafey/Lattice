import { CoreSaaSApp } from '../../../index';

export function createAuthorize(app: CoreSaaSApp, requiredPermission: string, options?: { contextRequired?: boolean }) {
  return async function authorize(req: any, res: any, next?: (err?: any) => void) {
    try {
      const userId: string | null = (req?.headers?.['x-user-id'] as string) || req?.user?.id || null;
      const contextId: string | null =
        (req?.params?.['contextId'] as string) ||
        (req?.headers?.['x-context-id'] as string) ||
        (req?.query?.['contextId'] as string) ||
        null;

      const send = (statusCode: number, body: any) => {
        if (typeof res?.status === 'function') {
          return res.status(statusCode).send(body);
        }
        if (typeof res?.code === 'function') {
          return res.code(statusCode).send(body);
        }
        if (typeof next === 'function') return next(body);
      };

      if (!userId) {
        const err = { statusCode: 401, message: 'Unauthorized' };
        return send(401, err);
      }

      if (options?.contextRequired && !contextId) {
        const err = { statusCode: 400, message: 'Context required' };
        return send(400, err);
      }

      const allowed = await app.checkAccess({ userId, contextId: contextId ?? undefined, permission: requiredPermission });

      if (!allowed) {
        const err = { statusCode: 403, message: 'Forbidden' };
        return send(403, err);
      }

      if (next) return next();
      return;
    } catch (error) {
      if (typeof res?.status === 'function') return res.status(500).send({ message: 'Internal Server Error' });
      if (typeof res?.code === 'function') return res.code(500).send({ message: 'Internal Server Error' });
      if (next) return next(error);
    }
  };
}


