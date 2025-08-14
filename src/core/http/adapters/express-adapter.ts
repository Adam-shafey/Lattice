import express, { Express, Request, Response, NextFunction } from 'express';
import type { CoreSaaSApp, HttpAdapter, RouteDefinition } from '../../../index';

export interface ExpressHttpAdapter extends HttpAdapter {
  getUnderlying: () => Express;
}

export function createExpressAdapter(app: CoreSaaSApp): ExpressHttpAdapter {
  const instance: Express = express();
  instance.use(express.json());

  function wrapPreHandler(h: unknown) {
    return h as any as (req: Request, res: Response, next: NextFunction) => void;
  }

  function wrapHandler(handler: RouteDefinition['handler']) {
    return async function (req: Request, res: Response) {
      const userId = (req.header('x-user-id') as string) || null;
      const contextId =
        (req.params?.['contextId'] as string) ||
        (req.header('x-context-id') as string) ||
        (req.query?.['contextId'] as string) ||
        null;
      const contextType =
        (req.params?.['contextType'] as string) ||
        (req.header('x-context-type') as string) ||
        (req.query?.['contextType'] as string) ||
        null;

      const context = contextId ? { id: contextId, type: contextType ?? 'unknown' } : null;
      const user = userId ? { id: userId } : null;

      const result = await handler({
        user,
        context,
        body: (req.body ?? {}) as unknown,
        params: (req.params as Record<string, string>) ?? {},
        query: (req.query as Record<string, string | string[]>) ?? {},
        req,
      });
      res.send(result);
    };
  }

  const adapter: ExpressHttpAdapter = {
    addRoute(route: RouteDefinition) {
      const preHandlers = Array.isArray(route.preHandler) ? route.preHandler : route.preHandler ? [route.preHandler] : [];
      const handlers = [...preHandlers.map(wrapPreHandler), wrapHandler(route.handler)];
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
          throw new Error(`Unsupported method ${route.method}`);
      }
    },
    async listen(port: number, host?: string) {
      await new Promise<void>((resolve) => {
        instance.listen(port, host ?? '0.0.0.0', () => resolve());
      });
      // eslint-disable-next-line no-console
      console.log(`Express server listening on http://${host ?? '0.0.0.0'}:${port}`);
    },
    getUnderlying() {
      return instance;
    },
  };

  return adapter;
}


