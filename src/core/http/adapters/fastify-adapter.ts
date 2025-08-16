import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { CoreSaaSApp, HttpAdapter, RouteDefinition } from '../../../index';
import { extractRequestContext } from '../utils/extract-request-context';
import logger from '../utils/logger';

export interface FastifyHttpAdapter extends HttpAdapter {
  getUnderlying: () => FastifyInstance;
}

/**
 * Creates a Fastify HTTP adapter for the CoreSaaS application
 * 
 * This adapter wraps Fastify functionality to provide a consistent
 * interface for route registration and server management.
 * 
 * @param app - The CoreSaaS application instance
 * @returns FastifyHttpAdapter instance
 */
export function createFastifyAdapter(app: CoreSaaSApp): FastifyHttpAdapter {
  const instance: FastifyInstance = fastify({
    logger: logger,
    trustProxy: true
  });

  // Register CORS plugin to allow requests from frontend development server
  instance.register(fastifyCors, {
    origin: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000', // Production admin UI
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ],
    credentials: true, // Allow cookies/credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });

  // Register Swagger for API documentation
  instance.register(fastifySwagger, {
    swagger: {
      info: {
        title: 'Lattice Access Control API',
        description: 'API documentation for Lattice Access Control System',
        version: '1.0.0',
        contact: {
          name: 'Lattice Team',
          email: 'support@lattice.dev'
        }
      },
      host: 'localhost:3000',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'Bearer token for authentication'
        }
      },
      security: [
        {
          Bearer: []
        }
      ],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'users', description: 'User management endpoints' },
        { name: 'roles', description: 'Role management endpoints' },
        { name: 'permissions', description: 'Permission management endpoints' },
        { name: 'contexts', description: 'Context management endpoints' }
      ]
    }
  });

  // Register Swagger UI
  instance.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header
  });

  /**
   * Wraps a route handler to work with Fastify
   * 
   * Extracts user and context information from the request and
   * passes it to the handler in a standardized format.
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
        
        // Send the response
        if (!reply.sent) {
          reply.send(result);
        }
      } catch (error) {
        // Handle errors gracefully
        logger.error({ err: error }, 'Fastify handler error');
        
        // Check if response was already sent
        if (reply.sent) {
          return;
        }
        
        // Check for custom error with status code
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as any).statusCode;
          const response: any = { 
            error: 'Invalid input',
            message: error instanceof Error ? error.message : 'Unknown error'
          };
          
          // Add issues if present
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
   * 
   * Normalizes middleware signatures to be Fastify-compatible.
   */
  function wrapPreHandler(pre: unknown) {
    return function (request: FastifyRequest, reply: FastifyReply, done: (err?: any) => void) {
      try {
        // Create a next function that the middleware can call
        const next = (err?: any) => {
          if (err) {
            // If there's an error, pass it to done
            done(err);
          } else {
            // If no error, continue
            done();
          }
        };
        
        const maybePromise = (pre as any)(request, reply, next);
        
        if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
          // Handle async middleware
          (maybePromise as Promise<unknown>)
            .then(() => {
              // Check if reply was sent by middleware
              if (reply.sent) {
                // Middleware already sent a response, don't call done
                return;
              }
              // No response sent, continue
              done();
            })
            .catch((err) => {
              // Check if reply was sent by middleware
              if (reply.sent) {
                // Middleware already sent a response, don't call done
                return;
              }
              // No response sent, pass error to done
              done(err);
            });
        } else {
          // Check if reply was sent by middleware
          if (reply.sent) {
            // Middleware already sent a response, don't call done
            return;
          }
          // No response sent, continue
          done();
        }
      } catch (err) {
        // Check if reply was sent by middleware
        if (reply.sent) {
          // Middleware already sent a response, don't call done
          return;
        }
        // No response sent, pass error to done
        done(err);
      }
    };
  }

  const adapter: FastifyHttpAdapter = {
    /**
     * Adds a route to the Fastify application
     */
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

    /**
     * Starts the Fastify server
     */
    async listen(port: number, host?: string) {
      await instance.listen({ port, host });
    },

    /**
     * Returns the underlying Fastify instance
     */
    getUnderlying() {
      return instance;
    },
  };

  return adapter;
}


