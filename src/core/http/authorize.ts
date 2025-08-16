import { CoreSaaSApp } from '../../index';

type AuthorizeScope = 'exact' | 'global' | 'type-wide';

export interface AuthorizeOptions {
  contextRequired?: boolean;
  scope?: AuthorizeScope;
  contextType?: string;
}

function getValue(req: any, getters: Array<(r: any) => unknown>): string | null {
  for (const g of getters) {
    const val = g(req);
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return null;
}

function respond(res: any, next: ((err?: any) => void) | undefined, status: number, body: any) {
  if (res?.sent) return;
  if (typeof res?.status === 'function') return res.status(status).send(body);
  if (typeof res?.code === 'function') return res.code(status).send(body);
  if (typeof next === 'function') return next(body);
}

export function createAuthorize(app: CoreSaaSApp, requiredPermission: string, options: AuthorizeOptions = {}) {
  return async function authorize(req: any, res: any, next?: (err?: any) => void) {
    try {
      const userId =
        getValue(req, [r => r?.headers?.['x-user-id'], r => r?.user?.id]);
      const contextId = getValue(req, [
        r => r?.params?.['contextId'],
        r => r?.headers?.['x-context-id'],
        r => r?.query?.['contextId'],
        r => r?.body?.contextId
      ]);
      const requestContextType = getValue(req, [
        r => r?.params?.['contextType'],
        r => r?.headers?.['x-context-type'],
        r => r?.query?.['contextType'],
        r => r?.body?.contextType
      ]);
      const contextType = requestContextType ?? options.contextType ?? null;

      if (!userId) {
        return respond(res, next, 401, { statusCode: 401, message: 'Unauthorized' });
      }

      if (options.contextRequired && !contextId) {
        return respond(res, next, 400, { statusCode: 400, message: 'Context required' });
      }

      if (options.scope === 'global' && (contextId || contextType)) {
        return respond(res, next, 403, {
          statusCode: 403,
          message: 'This operation requires global scope'
        });
      }

      if (options.scope === 'type-wide' && !contextType) {
        return respond(res, next, 400, {
          statusCode: 400,
          message: 'Context type required for type-wide operation'
        });
      }

      if (options.scope === 'exact' && !contextId) {
        return respond(res, next, 400, {
          statusCode: 400,
          message: 'Context ID required for exact scope operation'
        });
      }

      const allowed = await app.checkAccess({
        userId,
        context: contextId ? { id: contextId, type: requestContextType ?? 'unknown' } : null,
        permission: requiredPermission,
        scope: options.scope,
        contextType: contextType ?? undefined
      });

      if (!allowed) {
        return respond(res, next, 403, { statusCode: 403, message: 'Forbidden' });
      }

      return next?.();
    } catch (error) {
      if (res?.sent) return;
      if (typeof res?.status === 'function') return res.status(500).send({ message: 'Internal Server Error' });
      if (typeof res?.code === 'function') return res.code(500).send({ message: 'Internal Server Error' });
      if (next) return next(error);
    }
  };
}


