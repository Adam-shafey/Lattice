import { logger } from '../logger';

export interface Attributes {
  user: Record<string, unknown>;
  resource?: Record<string, unknown> | null;
  env?: Record<string, unknown> | null;
}

export interface AbacPolicy {
  id: string;
  target: { action: string; resource: string };
  condition: string;
  effect: 'permit' | 'deny';
}

export interface EvaluateResult {
  decision: 'permit' | 'deny';
  policy?: AbacPolicy;
}

export class AbacEngine {
  private policies: AbacPolicy[];
  private readonly defaultDecision: 'permit' | 'deny';

  constructor(policies: AbacPolicy[] = [], defaultDecision: 'permit' | 'deny' = 'permit') {
    this.policies = policies;
    this.defaultDecision = defaultDecision;
  }

  public setPolicies(policies: AbacPolicy[]): void {
    this.policies = policies;
  }

  public addPolicy(policy: AbacPolicy): void {
    this.policies.push(policy);
  }

  public hasPolicies(): boolean {
    return this.policies.length > 0;
  }

  public evaluate(action: string, resource: string, attributes: Attributes): EvaluateResult {
    const relevant = this.policies.filter(p => p.target.action === action && p.target.resource === resource);
    logger.log('\uD83D\uDD10 [ABAC] Evaluating', { action, resource, relevantPolicies: relevant.length });

    let decision: 'permit' | 'deny' = this.defaultDecision;
    let matchedPolicy: AbacPolicy | undefined;

    for (const policy of relevant) {
      const ctx = { user: attributes.user, resource: attributes.resource ?? {}, env: attributes.env ?? {} };
      let conditionResult = false;
      try {
        const fn = new Function('user', 'resource', 'env', `return (${policy.condition});`);
        conditionResult = Boolean(fn(ctx.user, ctx.resource, ctx.env));
      } catch (err) {
        logger.error('\uD83D\uDD10 [ABAC] Error evaluating policy condition', { policy: policy.id, err });
        continue;
      }

      logger.log('\uD83D\uDD10 [ABAC] Policy evaluation', { policy: policy.id, conditionResult, effect: policy.effect });

      if (conditionResult) {
        matchedPolicy = policy;
        if (policy.effect === 'deny') {
          decision = 'deny';
          break;
        }
        decision = 'permit';
      }
    }

    logger.log('\uD83D\uDD10 [ABAC] Final decision', { decision, matchedPolicy: matchedPolicy?.id });

    return { decision, policy: matchedPolicy };
  }
}

