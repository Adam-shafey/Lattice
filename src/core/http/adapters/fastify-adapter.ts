import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
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
 * 
 * This adapter wraps Fastify functionality to provide a consistent
 * interface for route registration and server management.
 * 
 * @param app - The CoreSaaS application instance
 * @returns FastifyHttpAdapter instance
 */
export function createFastifyAdapter(app: CoreSaaSApp): FastifyHttpAdapter {
  const instance: FastifyInstance = fastify({
    logger: true,
    trustProxy: true
  });

  instance.register(swagger, {
    mode: 'static',
    specification: { document: swaggerDocument }
  });
  instance.register(swaggerUi, { routePrefix: '/docs' });

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
        console.error('Fastify handler error:', error);
        
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


