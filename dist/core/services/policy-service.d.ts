import { BaseService, type ServiceContext } from './base-service';
import { IPolicyService } from './interfaces';
import type { AbacPolicy, PrismaClient } from '../db/db-client';
/**
 * PolicyService
 *
 * Provides CRUD operations for ABAC policies stored in the database.
 * This service is intentionally lightweight and focuses on persistence.
 */
export declare class PolicyService extends BaseService implements IPolicyService {
    constructor(db: PrismaClient);
    createPolicy(params: {
        action: string;
        resource: string;
        condition: string;
        effect: 'permit' | 'deny';
        context?: ServiceContext;
    }): Promise<AbacPolicy>;
    getPolicy(id: string, context?: ServiceContext): Promise<AbacPolicy | null>;
    listPolicies(context?: ServiceContext): Promise<AbacPolicy[]>;
    updatePolicy(id: string, data: {
        action?: string;
        resource?: string;
        condition?: string;
        effect?: 'permit' | 'deny';
        context?: ServiceContext;
    }): Promise<AbacPolicy>;
    deletePolicy(id: string, context?: ServiceContext): Promise<void>;
}
export default PolicyService;
