import express, { Express, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import type { CoreSaaSApp, HttpAdapter, RouteDefinition } from '../../../index';
import { extractRequestContext } from '../utils/extract-request-context';
import swaggerDocument from '../../../swagger-output.json';

export interface ExpressHttpAdapter extends HttpAdapter {
  getUnderlying: () => Express;
}

/**
 * Creates an Express HTTP adapter for the CoreSaaS application
 * 
 * This adapter wraps Express.js functionality to provide a consistent
 * interface for route registration and server management.
 * 
 * @param app - The CoreSaaS application instance
 * @returns ExpressHttpAdapter instance
 */
export function createExpressAdapter(app: CoreSaaSApp): ExpressHttpAdapter {
  const instance: Express = express();

  // Configure Express middleware
  instance.use(express.json());
  instance.use(express.urlencoded({ extended: true }));

  instance.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  /**
   * Wraps a pre-handler function to work with Express middleware
   */
  function wrapPreHandler(handler: unknown) {
    return handler as (req: Request, res: Response, next: NextFunction) => void;
  }

  /**
   * Wraps a route handler to work with Express
   * 
   * Extracts user and context information from the request and
   * passes it to the handler in a standardized format.
   */
  function wrapHandler(handler: RouteDefinition['handler']) {
    return async function (req: Request, res: Response) {
      try {
        const { user, context, body, params, query } = extractRequestContext(req);

        const result = await handler({
          user,
          context,
          body,
          params: params as Record<string, string>,
          query: query as Record<string, string | string[]>,
          req,
        });
        
        // Send the response
        res.send(result);
      } catch (error) {
        // Handle errors gracefully
        console.error('Express handler error:', error);
        res.status(500).send({ 
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };
  }

  const adapter: ExpressHttpAdapter = {
    /**
     * Adds a route to the Express application
     */
    addRoute(route: RouteDefinition) {
      const preHandlers = Array.isArray(route.preHandler)
        ? route.preHandler
        : route.preHandler
          ? [route.preHandler]
          : [];

      const handlers = [...preHandlers.map(wrapPreHandler), wrapHandler(route.handler)];
      
      // Register the route based on HTTP method
      switch (route.method) {
        case 'GET':
          instance.get(route.path, ...handlers);
          break;
        case 'POST':
          instance.post(route.path, ...handlers);
          break;
        case 'PUT':
          instance.put(route.path, ...handlers);
          break;
        case 'PATCH':
          instance.patch(route.path, ...handlers);
          break;
        case 'DELETE':
          instance.delete(route.path, ...handlers);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${route.method}`);
      }
    },

    /**
     * Starts the Express server
     */
    async listen(port: number, host?: string) {
      return new Promise<void>((resolve) => {
        instance.listen(port, host ?? '0.0.0.0', () => {
          console.log(`Express server listening on http://${host ?? '0.0.0.0'}:${port}`);
          resolve();
        });
      });
    },

    /**
     * Returns the underlying Express instance
     */
    getUnderlying() {
      return instance;
    },
  };

  return adapter;
}


