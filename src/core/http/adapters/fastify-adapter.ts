import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { CoreSaaSApp, HttpAdapter, RouteDefinition } from '../../../index';
import { extractRequestContext } from '../utils/extract-request-context';
import swaggerDocument from '../../../swagger-output.json';

export interface FastifyHttpAdapter extends HttpAdapter {
  getUnderlying: () => FastifyInstance;
}

/**
 * Creates a Fastify HTTP adapter for the CoreSaaS application
 */
export function createFastifyAdapter(app: CoreSaaSApp): FastifyHttpAdapter {
  const instance: FastifyInstance = fastify({
    logger: true,
    trustProxy: true
  });

  // CORS (from main)
  instance.register(fastifyCors, {
    origin: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000', // Production admin UI
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });

  // Swagger using static document (from codex), with UI config (from main)
  instance.register(swagger, {
    mode: 'static',
    specification: { document: swaggerDocument }
  });

  instance.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    },
    staticCSP: true,
    transformStaticCSP: (header) => header
  });

  /**
   * Wraps a route handler to work with Fastify
   */
  function wrapHandler(handler: RouteDefinition['handler']) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const { user, context, body, params, query } = extractRequestContext(request);

        const result = await handler({
          user,
          context,
          body,
          params: params as Record<string, string>,
          query: query as Record<string, string | string[]>,
          req: request,
        });

        if (!reply.sent) {
          reply.send(result);
        }
      } catch (error) {
        console.error('Fastify handler error:', error);

        if (reply.sent) return;

        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as any).statusCode;
          const response: any = {
            error: 'Invalid input',
            message: error instanceof Error ? error.message : 'Unknown error'
          };
          if ('issues' in error) {
            response.issues = (error as any).issues;
          }
          reply.status(statusCode).send(response);
        } else {
          reply.status(500).send({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    };
  }

  /**
   * Wraps a pre-handler function to work with Fastify middleware
   */
  function wrapPreHandler(pre: unknown) {
    return function (request: FastifyRequest, reply: FastifyReply, done: (err?: any) => void) {
      try {
        const next = (err?: any) => (err ? done(err) : done());
        const maybePromise = (pre as any)(request, reply, next);

        if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
          (maybePromise as Promise<unknown>)
            .then(() => {
              if (!reply.sent) done();
            })
            .catch((err) => {
              if (!reply.sent) done(err);
            });
        } else {
          if (!reply.sent) done();
        }
      } catch (err) {
        if (!reply.sent) done(err);
      }
    };
  }

  const adapter: FastifyHttpAdapter = {
    addRoute(route: RouteDefinition) {
      const preHandlers = Array.isArray(route.preHandler)
        ? route.preHandler
        : route.preHandler
          ? [route.preHandler]
          : [];

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
