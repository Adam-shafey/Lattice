import { evaluate } from 'cel-js';
import { logger } from '../logger';
import type { IPolicyService } from '../services/interfaces';
import type { AbacPolicy } from '../db/db-client';

export interface AttributeProvider {
  getUserAttributes(userId: string): Promise<Record<string, any>>;
  getResourceAttributes(resource: { type: string; id: string | null } | null): Promise<Record<string, any>>;
  getEnvironmentAttributes(): Promise<Record<string, any>>;
}

export class DefaultAttributeProvider implements AttributeProvider {
  async getUserAttributes(userId: string): Promise<Record<string, any>> {
    return { id: userId };
  }
  async getResourceAttributes(resource: { type: string; id: string | null } | null): Promise<Record<string, any>> {
    return resource ? { ...resource } : {};
  }
  async getEnvironmentAttributes(): Promise<Record<string, any>> {
    return { time: new Date().toISOString() };
  }
}

let cache: { policies: AbacPolicy[]; expiry: number } | null = null;

export function invalidatePolicyCache() {
  cache = null;
}

async function loadPolicies(service: IPolicyService): Promise<AbacPolicy[]> {
  const now = Date.now();
  if (!cache || now > cache.expiry) {
    const policies = await service.listPolicies();
    cache = { policies, expiry: now + 30000 }; // 30s TTL
  }
  return cache.policies;
}

export async function evaluateAbac(
  service: IPolicyService,
  attributeProvider: AttributeProvider,
  params: {
    action: string;
    resource: string;
    resourceId: string | null;
    userId: string;
  }
): Promise<boolean> {
  const policies = await loadPolicies(service);
  const relevant = policies.filter(p => p.action === params.action && p.resource === params.resource);
  if (relevant.length === 0) {
    logger.log('🛡️ [ABAC] No policies matched - default allow');
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
      const result = evaluate(policy.condition, attrs);
      logger.log('🛡️ [ABAC] Policy', policy.id, 'evaluation result:', result);
      if (result) {
        if (policy.effect === 'deny') {
          logger.log('🛡️ [ABAC] Deny override from policy', policy.id);
          return false;
        }
        if (policy.effect === 'permit') {
          permit = true;
        }
      }
    } catch (err) {
      logger.error('🛡️ [ABAC] Error evaluating policy', policy.id, err);
    }
  }
  return permit;
}
