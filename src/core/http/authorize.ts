import { CoreSaaSApp } from '../../index';

type AuthorizeScope = 'exact' | 'global' | 'type-wide';

export interface AuthorizeOptions {
  contextRequired?: boolean;
  scope?: AuthorizeScope;
  contextType?: string;
}

// Extend the CoreSaaSApp interface in index.ts instead

export function createAuthorize(app: CoreSaaSApp, requiredPermission: string, options?: AuthorizeOptions) {
  return async function authorize(req: any, res: any, next?: (err?: any) => void) {
    try {
      const userId: string | null = (req?.headers?.['x-user-id'] as string) || req?.user?.id || null;
      const contextId: string | null =
        (req?.params?.['contextId'] as string) ||
        (req?.headers?.['x-context-id'] as string) ||
        (req?.query?.['contextId'] as string) ||
        (req?.body?.contextId as string) ||
        null;
      const contextType: string | null =
        (req?.params?.['contextType'] as string) ||
        (req?.headers?.['x-context-type'] as string) ||
        (req?.query?.['contextType'] as string) ||
        (req?.body?.contextType as string) ||
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

      // Scope validation
      if (options?.scope === 'global' && (contextId !== null || contextType !== null)) {
        const err = { statusCode: 403, message: 'This operation requires global scope' };
        return send(403, err);
      }

      if (options?.scope === 'type-wide' && !contextType) {
        const err = { statusCode: 400, message: 'Context type required for type-wide operation' };
        return send(400, err);
      }

      if (options?.scope === 'exact' && !contextId) {
        const err = { statusCode: 400, message: 'Context ID required for exact scope operation' };
        return send(400, err);
      }

      const allowed = await app.checkAccess({ 
        userId, 
        context: contextId ? { id: contextId, type: contextType ?? 'unknown' } : null, 
        permission: requiredPermission,
        requireGlobal: options?.scope === 'global',
        requireTypeWide: options?.scope === 'type-wide'
      });

      if (!allowed) {
        try {
          await app.auditService.logPermissionCheck(userId, contextId, requiredPermission, false);
        } catch {}
        const err = { statusCode: 403, message: 'Forbidden' };
        return send(403, err);
      }

      try {
        await app.auditService.logPermissionCheck(userId, contextId, requiredPermission, true);
      } catch {}
      if (next) return next();
      return;
    } catch (error) {
      if (typeof res?.status === 'function') return res.status(500).send({ message: 'Internal Server Error' });
      if (typeof res?.code === 'function') return res.code(500).send({ message: 'Internal Server Error' });
      if (next) return next(error);
    }
  };
}


