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
         console.log('Authorize: Sending response:', statusCode, body);
         // Check if response was already sent
         if (res?.sent) {
           console.log('Authorize: Response already sent, skipping');
           return true; // Indicate response was sent
         }
         
         if (typeof res?.status === 'function') {
           console.log('Authorize: Using res.status');
           res.status(statusCode).send(body);
           return true; // Indicate response was sent
         }
         if (typeof res?.code === 'function') {
           console.log('Authorize: Using res.code');
           res.code(statusCode).send(body);
           return true; // Indicate response was sent
         }
         if (typeof next === 'function') {
           console.log('Authorize: Using next with error');
           next(body);
           return true; // Indicate response was sent
         }
         console.log('Authorize: No response method found');
         return false; // Indicate no response was sent
       };

      if (!userId) {
        const err = { statusCode: 401, message: 'Unauthorized' };
        if (send(401, err)) return;
      }

      if (options?.contextRequired && !contextId) {
        const err = { statusCode: 400, message: 'Context required' };
        if (send(400, err)) return;
      }

      // Scope validation
      if (options?.scope === 'global' && (contextId !== null || contextType !== null)) {
        const err = { statusCode: 403, message: 'This operation requires global scope' };
        if (send(403, err)) return;
      }

      // For type-wide scope, we need contextType
      if (options?.scope === 'type-wide') {
        if (!contextType) {
          if (contextId) {
            // Derive contextType from contextId (assuming 'team' for now)
            const derivedContextType = 'team';
            const allowed = await app.checkAccess({ 
              userId, 
              context: { id: contextId, type: derivedContextType }, 
              permission: requiredPermission,
              scope: options?.scope
            });
            
            if (!allowed) {
              try {
                await app.auditService.logPermissionCheck(userId, contextId, requiredPermission, false);
              } catch {}
              const err = { statusCode: 403, message: 'Forbidden' };
              if (send(403, err)) return;
            }
            
            try {
              await app.auditService.logPermissionCheck(userId, contextId, requiredPermission, true);
            } catch {}
            if (next) return next();
            return;
          } else {
            const err = { statusCode: 400, message: 'Context type required for type-wide operation' };
            if (send(400, err)) return;
          }
                 } else {
           // We have contextType, check type-wide permissions
           console.log('Authorize: Checking type-wide permission:', requiredPermission, 'for user:', userId, 'contextType:', contextType);
           const allowed = await app.checkAccess({ 
             userId, 
             context: null, // For type-wide, we don't need a specific context
             permission: requiredPermission,
             scope: options?.scope,
             contextType: contextType!
           });
           
           console.log('Authorize: Type-wide check result:', allowed);
           
                       if (!allowed) {
              try {
                await app.auditService.logPermissionCheck(userId, null, requiredPermission, false);
              } catch {}
              const err = { statusCode: 403, message: 'Forbidden' };
              console.log('Authorize: Permission denied, sending 403');
              if (send(403, err)) return;
            }
           
           try {
             await app.auditService.logPermissionCheck(userId, null, requiredPermission, true);
           } catch {}
           if (next) return next();
           return;
         }
      }

      if (options?.scope === 'exact' && !contextId) {
        const err = { statusCode: 400, message: 'Context ID required for exact scope operation' };
        if (send(400, err)) return;
      }

      const allowed = await app.checkAccess({ 
        userId, 
        context: contextId ? { id: contextId, type: contextType ?? 'unknown' } : null, 
        permission: requiredPermission,
        scope: options?.scope
      });

      if (!allowed) {
        try {
          await app.auditService.logPermissionCheck(userId, contextId, requiredPermission, false);
        } catch {}
        const err = { statusCode: 403, message: 'Forbidden' };
        if (send(403, err)) return;
      }

      try {
        await app.auditService.logPermissionCheck(userId, contextId, requiredPermission, true);
      } catch {}
      if (next) return next();
      return;
    } catch (error) {
      // Check if response was already sent
      if (res?.sent) {
        return;
      }
      
      if (typeof res?.status === 'function') return res.status(500).send({ message: 'Internal Server Error' });
      if (typeof res?.code === 'function') return res.code(500).send({ message: 'Internal Server Error' });
      if (next) return next(error);
    }
  };
}


