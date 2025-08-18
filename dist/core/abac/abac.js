"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultAttributeProvider = void 0;
exports.invalidatePolicyCache = invalidatePolicyCache;
exports.evaluateAbac = evaluateAbac;
const cel_js_1 = require("cel-js");
const logger_1 = require("../logger");
class DefaultAttributeProvider {
    async getUserAttributes(userId) {
        return { id: userId };
    }
    async getResourceAttributes(resource) {
        return resource ? { ...resource } : {};
    }
    async getEnvironmentAttributes() {
        return { time: new Date().toISOString() };
    }
}
exports.DefaultAttributeProvider = DefaultAttributeProvider;
let cache = null;
function invalidatePolicyCache() {
    cache = null;
}
async function loadPolicies(service) {
    const now = Date.now();
    if (!cache || now > cache.expiry) {
        const policies = await service.listPolicies();
        cache = { policies, expiry: now + 30000 }; // 30s TTL
    }
    return cache.policies;
}
async function evaluateAbac(service, attributeProvider, params) {
    const policies = await loadPolicies(service);
    const relevant = policies.filter(p => p.action === params.action && p.resource === params.resource);
    if (relevant.length === 0) {
        logger_1.logger.log('🛡️ [ABAC] No policies matched - default allow');
        return true; // maintain backward compatibility
    }
    const attrs = {
        user: await attributeProvider.getUserAttributes(params.userId),
        resource: await attributeProvider.getResourceAttributes({ type: params.resource, id: params.resourceId }),
        environment: await attributeProvider.getEnvironmentAttributes()
    };
    let permit = false;
    for (const policy of relevant) {
        try {
            const result = (0, cel_js_1.evaluate)(policy.condition, attrs);
            logger_1.logger.log('🛡️ [ABAC] Policy', policy.id, 'evaluation result:', result);
            if (result) {
                if (policy.effect === 'deny') {
                    logger_1.logger.log('🛡️ [ABAC] Deny override from policy', policy.id);
                    return false;
                }
                if (policy.effect === 'permit') {
                    permit = true;
                }
            }
        }
        catch (err) {
            logger_1.logger.error('🛡️ [ABAC] Error evaluating policy', policy.id, err);
        }
    }
    return permit;
}
