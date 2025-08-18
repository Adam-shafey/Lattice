"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRequestContext = extractRequestContext;
function extractRequestContext(req) {
    const headers = req.headers ?? {};
    const params = (req.params ?? {});
    const query = (req.query ?? {});
    const body = (req.body ?? {});
    const userId = req.user?.id || headers['x-user-id'] || null;
    const contextId = params['contextId'] ||
        headers['x-context-id'] ||
        query['contextId'] ||
        null;
    const contextType = params['contextType'] ||
        headers['x-context-type'] ||
        query['contextType'] ||
        null;
    const context = contextId ? { id: String(contextId), type: (contextType ?? 'unknown') } : null;
    const user = userId ? { id: String(userId) } : null;
    return {
        user,
        context,
        body,
        params,
        query,
    };
}
