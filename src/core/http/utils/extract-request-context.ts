import type { Request as ExpressRequest } from 'express';
import type { FastifyRequest } from 'fastify';

export interface ExtractedRequestContext<Body = unknown, Params = any, Query = any> {
  user: { id: string } | null;
  context: { id: string; type: string } | null;
  body: Body;
  params: Params;
  query: Query;
}

type AnyRequest<Body, Params, Query> =
  | ExpressRequest<Params, any, Body, Query>
  | FastifyRequest<{ Body?: Body; Params?: Params; Querystring?: Query }>;

export function extractRequestContext<Body = unknown, Params = any, Query = any>(
  req: AnyRequest<Body, Params, Query>
): ExtractedRequestContext<Body, Params, Query> {
  const headers = (req as any).headers ?? {};
  const params = ((req as any).params ?? {}) as Params;
  const query = ((req as any).query ?? {}) as Query;
  const body = ((req as any).body ?? {}) as Body;

  const userId = (req as any).user?.id || (headers['x-user-id'] as string | undefined) || null;
  const contextId =
    (params as any)['contextId'] ||
    (headers['x-context-id'] as string | undefined) ||
    (query as any)['contextId'] ||
    null;
  const contextType =
    (params as any)['contextType'] ||
    (headers['x-context-type'] as string | undefined) ||
    (query as any)['contextType'] ||
    null;

  const context = contextId ? { id: String(contextId), type: (contextType ?? 'unknown') as string } : null;
  const user = userId ? { id: String(userId) } : null;

  return {
    user,
    context,
    body,
    params,
    query,
  };
}

