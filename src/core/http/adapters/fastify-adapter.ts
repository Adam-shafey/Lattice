import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { LatticeCore, HttpAdapter, RouteDefinition } from '../../../index';
import { extractRequestContext } from '../utils/extract-request-context';
import fs from 'fs';
import path from 'path';
import { logger } from '../../logger';

export interface FastifyHttpAdapter extends HttpAdapter {
  getUnderlying: () => FastifyInstance;
}

/**
 * Creates a Fastify HTTP adapter for the LatticeCore application
 */
export function createFastifyAdapter(app: LatticeCore): FastifyHttpAdapter {
  const instance: FastifyInstance = fastify({
    logger: true,
    trustProxy: true
  });

  // Configure CORS
  // Allowed origins can be specified via the LatticeCore config
  // (`allowedOrigins`) or the CORS_ALLOWED_ORIGINS environment variable
  // (comma-separated).
  // Example: CORS_ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
  // Defaults to an empty array to disallow all cross-origin requests unless
  // explicitly configured.
  const allowedOrigins =
    ((app as any)?.config?.allowedOrigins as string[] | undefined) ??
    process.env.CORS_ALLOWED_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ??
    [];

  instance.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Rate limiting plugin (configured per-route)
  instance.register(fastifyRateLimit, { global: false });

  // Read the generated swagger spec
  const swaggerSpecPath = path.join(__dirname, '../../../swagger-output.json');
  let swaggerSpec: any = {};
  
  try {
    if (fs.existsSync(swaggerSpecPath)) {
      swaggerSpec = JSON.parse(fs.readFileSync(swaggerSpecPath, 'utf8'));
    }
  } catch (error) {
    logger.warn('Could not load swagger spec, using minimal configuration');
  }

  // Swagger configuration using our generated spec
  instance.register(swagger, {
    mode: 'static',
    specification: {
      document: swaggerSpec
    }
  });

  // Swagger UI configuration
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
        logger.error('Fastify handler error:', error);

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
        config: route.config as any,
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
