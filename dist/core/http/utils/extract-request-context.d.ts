import type { Request as ExpressRequest } from 'express';
import type { FastifyRequest } from 'fastify';
export interface ExtractedRequestContext<Body = unknown, Params = any, Query = any> {
    user: {
        id: string;
    } | null;
    context: {
        id: string;
        type: string;
    } | null;
    body: Body;
    params: Params;
    query: Query;
}
type AnyRequest<Body, Params, Query> = ExpressRequest<Params, any, Body, Query> | FastifyRequest<{
    Body?: Body;
    Params?: Params;
    Querystring?: Query;
}>;
export declare function extractRequestContext<Body = unknown, Params = any, Query = any>(req: AnyRequest<Body, Params, Query>): ExtractedRequestContext<Body, Params, Query>;
export {};
