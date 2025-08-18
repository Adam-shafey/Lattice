import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { LatticeCore, HttpAdapter, RouteDefinition } from '../../../index';
import { extractRequestContext } from '../utils/extract-request-context';
import { logger } from '../../logger';

export interface ExpressHttpAdapter extends HttpAdapter {
  getUnderlying: () => Express;
}

/**
 * Creates an Express HTTP adapter for the LatticeCore application
 * 
 * This adapter wraps Express.js functionality to provide a consistent
 * interface for route registration and server management.
 * 
 * @param app - The LatticeCore application instance
 * @returns ExpressHttpAdapter instance
 */
export function createExpressAdapter(app: LatticeCore): ExpressHttpAdapter {
  const instance: Express = express();

  // Configure CORS
  instance.use(cors({
    origin: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000', // Production admin UI
      'http://localhost:8080', // Swagger UI
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Configure Express middleware
  instance.use(express.json());
  instance.use(express.urlencoded({ extended: true }));

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
        logger.error('Express handler error:', error);
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
          logger.log(`Express server listening on http://${host ?? '0.0.0.0'}:${port}`);
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


