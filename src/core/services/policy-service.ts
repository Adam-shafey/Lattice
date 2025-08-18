import { BaseService, type ServiceContext } from './base-service';
import { IPolicyService } from './interfaces';
import type { AbacPolicy, PrismaClient } from '../db/db-client';
import { invalidatePolicyCache } from '../abac/abac';

/**
 * PolicyService
 *
 * Provides CRUD operations for ABAC policies stored in the database.
 * This service is intentionally lightweight and focuses on persistence.
 */
export class PolicyService extends BaseService implements IPolicyService {
  constructor(db: PrismaClient) {
    super(db);
  }

  async createPolicy(params: {
    action: string;
    resource: string;
    condition: string;
    effect: 'permit' | 'deny';
    context?: ServiceContext;
  }): Promise<AbacPolicy> {
    const { action, resource, condition, effect, context } = params;
    this.validateString(action, 'action');
    this.validateString(resource, 'resource');
    this.validateString(condition, 'condition');
    this.validateString(effect, 'effect');

    const result = await this.execute(
      async () =>
        this.db.abacPolicy.create({ data: { action, resource, condition, effect } }),
      undefined,
      context
    );
    invalidatePolicyCache();
    return result;
  }

  async getPolicy(id: string, context?: ServiceContext): Promise<AbacPolicy | null> {
    this.validateString(id, 'policy id');
    return this.execute(
      async () => this.db.abacPolicy.findUnique({ where: { id } }),
      undefined,
      context
    );
  }

  async listPolicies(context?: ServiceContext): Promise<AbacPolicy[]> {
    return this.execute(async () => this.db.abacPolicy.findMany(), undefined, context);
  }

  async updatePolicy(
    id: string,
    data: {
      action?: string;
      resource?: string;
      condition?: string;
      effect?: 'permit' | 'deny';
      context?: ServiceContext;
    }
  ): Promise<AbacPolicy> {
    this.validateString(id, 'policy id');
    const { action, resource, condition, effect, context } = data;
    const result = await this.execute(
      async () =>
        this.db.abacPolicy.update({
          where: { id },
          data: { action, resource, condition, effect },
        }),
      undefined,
      context
    );
    invalidatePolicyCache();
    return result;
  }

  async deletePolicy(id: string, context?: ServiceContext): Promise<void> {
    this.validateString(id, 'policy id');
    await this.execute(
      async () => {
        await this.db.abacPolicy.delete({ where: { id } });
      },
      undefined,
      context
    );
    invalidatePolicyCache();
  }
}

export default PolicyService;
