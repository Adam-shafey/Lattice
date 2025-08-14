import { describe, it, expect } from 'vitest';
import { createJwtUtil } from '../core/auth/jwt';

describe('auth jwt', () => {
  it('signs and verifies tokens', () => {
    const jwt = createJwtUtil({ secret: 'test', accessTTL: '15m', refreshTTL: '7d' });
    const token = jwt.signAccess({ sub: 'user_1' });
    const payload = jwt.verify(token) as any;
    expect(payload.sub).toBe('user_1');
  });
});


