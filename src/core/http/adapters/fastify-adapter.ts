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

      const context = contextId ? { id: contextId } : null;
      const user = userId ? { id: userId } : null;

      const result = await handler({
        user,
        context,
        body: (request.body ?? {}) as unknown,
        params: (request.params as Record<string, string>) ?? {},
        query: (request.query as Record<string, string | string[]>) ?? {},
      });
      reply.send(result);
    };
  }

  const adapter: FastifyHttpAdapter = {
    addRoute(route: RouteDefinition) {
      const preHandlers = Array.isArray(route.preHandler) ? route.preHandler : route.preHandler ? [route.preHandler] : [];
      instance.route({
        method: route.method,
        url: route.path,
        preHandler: preHandlers as any,
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


