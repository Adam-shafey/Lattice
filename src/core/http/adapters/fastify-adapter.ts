import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { CoreSaaSApp, HttpAdapter, RouteDefinition } from '../../../index';

export interface FastifyHttpAdapter extends HttpAdapter {
  getUnderlying: () => FastifyInstance;
}

export function createFastifyAdapter(app: CoreSaaSApp): FastifyHttpAdapter {
  const instance: FastifyInstance = fastify({ logger: true });

  function wrapHandler(handler: RouteDefinition['handler']) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      const userId = (request.headers['x-user-id'] as string) || null;
      const contextId =
        (request.params as Record<string, string | undefined>)?.['contextId'] ||
        (request.headers['x-context-id'] as string) ||
        (request.query as Record<string, string | undefined>)?.['contextId'] ||
        null;
      const contextType =
        (request.params as Record<string, string | undefined>)?.['contextType'] ||
        (request.headers['x-context-type'] as string) ||
        (request.query as Record<string, string | undefined>)?.['contextType'] ||
        null;

      const context = contextId ? { id: contextId, type: contextType ?? 'unknown' } : null;
      const user = userId ? { id: userId } : null;

      const result = await handler({
        user,
        context,
        body: (request.body ?? {}) as unknown,
        params: (request.params as Record<string, string>) ?? {},
        query: (request.query as Record<string, string | string[]>) ?? {},
        req: request,
      });
      reply.send(result);
    };
  }

  function wrapPreHandler(pre: unknown) {
    // Normalize any middleware signature to Fastify-compatible (request, reply, done)
    // Our middlewares are typically (req, res, next?) and may be async
    return function (request: FastifyRequest, reply: FastifyReply, done: (err?: any) => void) {
      try {
        const maybePromise = (pre as any)(request, reply, undefined);
        if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
          (maybePromise as Promise<unknown>)
            .then(() => {
              if (!reply.sent) done();
            })
            .catch(done);
        } else {
          if (!reply.sent) done();
        }
      } catch (err) {
        done(err);
      }
    };
  }

  const adapter: FastifyHttpAdapter = {
    addRoute(route: RouteDefinition) {
      const preHandlers = Array.isArray(route.preHandler) ? route.preHandler : route.preHandler ? [route.preHandler] : [];
      instance.route({
        method: route.method,
        url: route.path,
        preHandler: preHandlers.map(wrapPreHandler),
        handler: wrapHandler(route.handler) as any,
      });
    },
    async listen(port: number, host?: string) {
      await instance.listen({ port, host });
    },
    getUnderlying() {
      return instance;
    },
  };

  return adapter;
}


