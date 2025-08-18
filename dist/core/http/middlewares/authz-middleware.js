"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthorize = createAuthorize;
// Extend the CoreSaaSApp interface in index.ts instead
function createAuthorize(app, requiredPermission, options) {
    return async function authorize(req, res, next) {
        try {
            const userId = req?.headers?.['x-user-id'] || req?.user?.id || null;
            const contextId = req?.params?.['contextId'] ||
                req?.headers?.['x-context-id'] ||
                req?.query?.['contextId'] ||
                req?.body?.contextId ||
                null;
            const contextType = req?.params?.['contextType'] ||
                req?.headers?.['x-context-type'] ||
                req?.query?.['contextType'] ||
                req?.body?.contextType ||
                null;
            const send = (statusCode, body) => {
                if (typeof res?.status === 'function') {
                    return res.status(statusCode).send(body);
                }
                if (typeof res?.code === 'function') {
                    return res.code(statusCode).send(body);
                }
                if (typeof next === 'function')
                    return next(body);
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
                }
                catch { }
                const err = { statusCode: 403, message: 'Forbidden' };
                return send(403, err);
            }
            try {
                await app.auditService.logPermissionCheck(userId, contextId, requiredPermission, true);
            }
            catch { }
            if (next)
                return next();
            return;
        }
        catch (error) {
            if (typeof res?.status === 'function')
                return res.status(500).send({ message: 'Internal Server Error' });
            if (typeof res?.code === 'function')
                return res.code(500).send({ message: 'Internal Server Error' });
            if (next)
                return next(error);
        }
    };
}
