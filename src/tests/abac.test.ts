import { describe, test, expect } from 'vitest';
import { evaluateAbac, AttributeProvider, invalidatePolicyCache } from '../core/abac/abac';
import { PolicyService } from '../core/services/policy-service';
import { db } from '../core/db/db-client';

class TestProvider implements AttributeProvider {
  async getUserAttributes(userId: string) {
    return { id: userId };
  }
  async getResourceAttributes(resource: { type: string; id: string | null } | null) {
    return { ownerId: 'user1', ...(resource || {}) };
  }
  async getEnvironmentAttributes() {
    return {};
  }
}

describe('ABAC policy evaluation', () => {
  const service = new PolicyService(db);
  const provider = new TestProvider();

  test('permits access when policy matches', async () => {
    await service.createPolicy({
      action: 'documents:read',
      resource: 'teamDocument',
      condition: 'user.id == resource.ownerId',
      effect: 'permit'
    });
    invalidatePolicyCache();
    const allowed = await evaluateAbac(service, provider, {
      action: 'documents:read',
      resource: 'teamDocument',
      resourceId: 'doc1',
      userId: 'user1'
    });
    expect(allowed).toBe(true);
  });

  test('denies access when user does not match', async () => {
    invalidatePolicyCache();
    const denied = await evaluateAbac(service, provider, {
      action: 'documents:read',
      resource: 'teamDocument',
      resourceId: 'doc1',
      userId: 'user2'
    });
    expect(denied).toBe(false);
  });

  test('allows access when no policies exist', async () => {
    await db.abacPolicy.deleteMany();
    invalidatePolicyCache();
    const allowed = await evaluateAbac(service, provider, {
      action: 'any:action',
      resource: 'anyResource',
      resourceId: null,
      userId: 'user1'
    });
    expect(allowed).toBe(true);
  });

  test('deny policy overrides permit policy', async () => {
    await db.abacPolicy.deleteMany();
    await service.createPolicy({
      action: 'documents:write',
      resource: 'teamDocument',
      condition: 'true',
      effect: 'permit'
    });
    await service.createPolicy({
      action: 'documents:write',
      resource: 'teamDocument',
      condition: 'true',
      effect: 'deny'
    });
    invalidatePolicyCache();
    const allowed = await evaluateAbac(service, provider, {
      action: 'documents:write',
      resource: 'teamDocument',
      resourceId: 'doc1',
      userId: 'user1'
    });
    expect(allowed).toBe(false);
  });

  test('evaluates environment attributes', async () => {
    class EnvProvider extends TestProvider {
      async getEnvironmentAttributes() {
        return { ip: '127.0.0.1' };
      }
    }
    const envProvider = new EnvProvider();
    await db.abacPolicy.deleteMany();
    await service.createPolicy({
      action: 'server:access',
      resource: 'server',
      condition: "environment.ip == '127.0.0.1'",
      effect: 'permit'
    });
    invalidatePolicyCache();
    const allowed = await evaluateAbac(service, envProvider, {
      action: 'server:access',
      resource: 'server',
      resourceId: null,
      userId: 'user1'
    });
    expect(allowed).toBe(true);
  });

  test('handles evaluation errors gracefully', async () => {
    await db.abacPolicy.deleteMany();
    await service.createPolicy({
      action: 'documents:read',
      resource: 'teamDocument',
      condition: 'user.id ==', // invalid condition
      effect: 'permit'
    });
    invalidatePolicyCache();
    const allowed = await evaluateAbac(service, provider, {
      action: 'documents:read',
      resource: 'teamDocument',
      resourceId: 'doc1',
      userId: 'user1'
    });
    expect(allowed).toBe(false);
  });
});
