import { describe, it, expect } from 'vitest';
import { CoreSaaS } from '../index';

describe('authZ middleware basic shape', () => {
  it('exposes authorize() without throwing', () => {
    const app = CoreSaaS({ db: { provider: 'sqlite' }, adapter: 'fastify', jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' } });
    const mw = app.authorize('example:read', { contextRequired: true });
    expect(typeof mw).toBe('function');
  });
});


