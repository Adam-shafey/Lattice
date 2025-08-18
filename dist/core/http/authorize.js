"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthorize = createAuthorize;
const logger_1 = require("../logger");
function getValue(req, getters) {
    for (const g of getters) {
        const val = g(req);
        if (typeof val === 'string' && val.length > 0)
            return val;
    }
    return null;
}
function respond(res, next, status, body) {
    if (res?.sent)
        return;
    if (typeof res?.status === 'function')
        return res.status(status).send(body);
    if (typeof res?.code === 'function')
        return res.code(status).send(body);
    if (typeof next === 'function')
        return next(body);
}
function createAuthorize(app, requiredPermission, options = {}) {
    return async function authorize(req, res, next) {
        logger_1.logger.log('🚨 [AUTHORIZE] ===== AUTHORIZE MIDDLEWARE CALLED =====');
        logger_1.logger.log('🚨 [AUTHORIZE] Starting authorization check');
        logger_1.logger.log('🚨 [AUTHORIZE] Required permission:', requiredPermission);
        logger_1.logger.log('🚨 [AUTHORIZE] Options:', options);
        logger_1.logger.log('🚨 [AUTHORIZE] Request headers:', req?.headers);
        logger_1.logger.log('🚨 [AUTHORIZE] Request user:', req?.user);
        try {
            const userId = getValue(req, [r => r?.headers?.['x-user-id'], r => r?.user?.id]);
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
            const contextType = requestContextType ?? options.contextType;
            logger_1.logger.log('🔐 [AUTHORIZE] Extracted values:');
            logger_1.logger.log('🔐 [AUTHORIZE] - userId:', userId);
            logger_1.logger.log('🔐 [AUTHORIZE] - contextId:', contextId);
            logger_1.logger.log('🔐 [AUTHORIZE] - requestContextType:', requestContextType);
            logger_1.logger.log('🔐 [AUTHORIZE] - final contextType:', contextType);
            if (!userId) {
                logger_1.logger.log('🔐 [AUTHORIZE] ❌ No userId found - returning 401');
                return respond(res, next, 401, { statusCode: 401, message: 'Unauthorized' });
            }
            if (options.contextRequired && !contextId) {
                logger_1.logger.log('🔐 [AUTHORIZE] ❌ Context required but not provided - returning 400');
                return respond(res, next, 400, { statusCode: 400, message: 'Context required' });
            }
            if (options.scope === 'global' && (contextId || contextType)) {
                logger_1.logger.log('🔐 [AUTHORIZE] ❌ Global scope but context provided - returning 403');
                return respond(res, next, 403, {
                    statusCode: 403,
                    message: 'This operation requires global scope'
                });
            }
            if (options.scope === 'type-wide' && !contextType) {
                logger_1.logger.log('🔐 [AUTHORIZE] ❌ Type-wide scope but no contextType - returning 400');
                return respond(res, next, 400, {
                    statusCode: 400,
                    message: 'Context type required for type-wide operation'
                });
            }
            if (options.scope === 'exact' && !contextId) {
                logger_1.logger.log('🔐 [AUTHORIZE] ❌ Exact scope but no contextId - returning 400');
                return respond(res, next, 400, {
                    statusCode: 400,
                    message: 'Context ID required for exact scope operation'
                });
            }
            logger_1.logger.log('🔐 [AUTHORIZE] ✅ All validation passed, calling checkAccess');
            logger_1.logger.log('🔐 [AUTHORIZE] checkAccess params:', {
                userId,
                context: contextId ? { id: contextId, type: requestContextType ?? 'unknown' } : null,
                permission: requiredPermission,
                scope: options.scope,
                contextType: contextType ?? undefined
            });
            const allowed = await app.checkAccess({
                userId,
                context: contextId ? { id: contextId, type: requestContextType ?? 'unknown' } : null,
                permission: requiredPermission,
                scope: options.scope,
                contextType: contextType ?? undefined
            });
            logger_1.logger.log('🔐 [AUTHORIZE] checkAccess result:', allowed);
            if (!allowed) {
                logger_1.logger.log('🔐 [AUTHORIZE] ❌ Access denied - returning 403');
                return respond(res, next, 403, { statusCode: 403, message: 'Forbidden' });
            }
            logger_1.logger.log('🔐 [AUTHORIZE] ✅ Access granted - calling next()');
            return next?.();
        }
        catch (error) {
            logger_1.logger.error('🔐 [AUTHORIZE] ❌ Error during authorization:', error);
            if (res?.sent)
                return;
            if (typeof res?.status === 'function')
                return res.status(500).send({ message: 'Internal Server Error' });
            if (typeof res?.code === 'function')
                return res.code(500).send({ message: 'Internal Server Error' });
            if (next)
                return next(error);
        }
    };
}
