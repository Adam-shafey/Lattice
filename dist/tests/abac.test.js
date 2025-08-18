"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const abac_1 = require("../core/abac/abac");
const policy_service_1 = require("../core/services/policy-service");
const db_client_1 = require("../core/db/db-client");
class TestProvider {
    async getUserAttributes(userId) {
        return { id: userId };
    }
    async getResourceAttributes(resource) {
        return { ownerId: 'user1', ...(resource || {}) };
    }
    async getEnvironmentAttributes() {
        return {};
    }
}
(0, vitest_1.describe)('ABAC policy evaluation', () => {
    const service = new policy_service_1.PolicyService(db_client_1.db);
    const provider = new TestProvider();
    (0, vitest_1.test)('permits access when policy matches', async () => {
        await service.createPolicy({
            action: 'documents:read',
            resource: 'teamDocument',
            condition: 'user.id == resource.ownerId',
            effect: 'permit'
        });
        (0, abac_1.invalidatePolicyCache)();
        const allowed = await (0, abac_1.evaluateAbac)(service, provider, {
            action: 'documents:read',
            resource: 'teamDocument',
            resourceId: 'doc1',
            userId: 'user1'
        });
        (0, vitest_1.expect)(allowed).toBe(true);
    });
    (0, vitest_1.test)('denies access when user does not match', async () => {
        (0, abac_1.invalidatePolicyCache)();
        const denied = await (0, abac_1.evaluateAbac)(service, provider, {
            action: 'documents:read',
            resource: 'teamDocument',
            resourceId: 'doc1',
            userId: 'user2'
        });
        (0, vitest_1.expect)(denied).toBe(false);
    });
});
