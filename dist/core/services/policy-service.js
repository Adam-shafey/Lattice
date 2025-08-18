"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyService = void 0;
const base_service_1 = require("./base-service");
const abac_1 = require("../abac/abac");
/**
 * PolicyService
 *
 * Provides CRUD operations for ABAC policies stored in the database.
 * This service is intentionally lightweight and focuses on persistence.
 */
class PolicyService extends base_service_1.BaseService {
    constructor(db) {
        super(db);
    }
    async createPolicy(params) {
        const { action, resource, condition, effect, context } = params;
        this.validateString(action, 'action');
        this.validateString(resource, 'resource');
        this.validateString(condition, 'condition');
        this.validateString(effect, 'effect');
        const result = await this.execute(async () => this.db.abacPolicy.create({ data: { action, resource, condition, effect } }), undefined, context);
        (0, abac_1.invalidatePolicyCache)();
        return result;
    }
    async getPolicy(id, context) {
        this.validateString(id, 'policy id');
        return this.execute(async () => this.db.abacPolicy.findUnique({ where: { id } }), undefined, context);
    }
    async listPolicies(context) {
        return this.execute(async () => this.db.abacPolicy.findMany(), undefined, context);
    }
    async updatePolicy(id, data) {
        this.validateString(id, 'policy id');
        const { action, resource, condition, effect, context } = data;
        const result = await this.execute(async () => this.db.abacPolicy.update({
            where: { id },
            data: { action, resource, condition, effect },
        }), undefined, context);
        (0, abac_1.invalidatePolicyCache)();
        return result;
    }
    async deletePolicy(id, context) {
        this.validateString(id, 'policy id');
        await this.execute(async () => {
            await this.db.abacPolicy.delete({ where: { id } });
        }, undefined, context);
        (0, abac_1.invalidatePolicyCache)();
    }
}
exports.PolicyService = PolicyService;
exports.default = PolicyService;
