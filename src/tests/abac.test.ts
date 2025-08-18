import { describe, it, expect } from 'vitest';
import { AbacEngine, type AbacPolicy } from '../core/policy/abac';

describe('ABAC engine', () => {
  it('denies when deny policy matches', () => {
    const policy: AbacPolicy = {
      id: 'team-doc-owner',
      target: { action: 'documents:read', resource: 'teamDocument' },
      condition: 'user.id != resource.ownerId',
      effect: 'deny'
    };
    const engine = new AbacEngine([policy]);
    const decision = engine.evaluate('documents:read', 'teamDocument', {
      user: { id: 'u1' },
      resource: { ownerId: 'u2' }
    });
    expect(decision.decision).toBe('deny');
    expect(decision.policy?.id).toBe('team-doc-owner');
  });

  it('permits when permit policy matches and no deny', () => {
    const policy: AbacPolicy = {
      id: 'team-doc-owner',
      target: { action: 'documents:read', resource: 'teamDocument' },
      condition: 'user.id == resource.ownerId',
      effect: 'permit'
    };
    const engine = new AbacEngine([policy]);
    const decision = engine.evaluate('documents:read', 'teamDocument', {
      user: { id: 'u1' },
      resource: { ownerId: 'u1' }
    });
    expect(decision.decision).toBe('permit');
  });
});
