import { describe, it, expect } from 'vitest';
import { ContextService } from '../core/services/context-service';

describe('context resolver', () => {
  const service = new ContextService();

  it('prefers route param over header and query', () => {
    const ctx = service.resolveContext({ routeParam: 'route_ctx', header: 'hdr_ctx', query: 'qry_ctx' });
    expect(ctx?.id).toBe('route_ctx');
  });

  it('falls back to header then query', () => {
    const ctx = service.resolveContext({ routeParam: null, header: 'hdr_ctx', query: 'qry_ctx' });
    expect(ctx?.id).toBe('hdr_ctx');
  });

  it('returns null when none provided', () => {
    const ctx = service.resolveContext({});
    expect(ctx).toBeNull();
  });
});


