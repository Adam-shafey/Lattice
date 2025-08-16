import { createFastifyAdapter, type FastifyHttpAdapter } from './core/http/adapters/fastify-adapter';
import { createExpressAdapter, type ExpressHttpAdapter } from './core/http/adapters/express-adapter';
import { PermissionRegistry } from './core/permissions/permission-registry';
import { createAuthorize, type AuthorizeOptions } from './core/http/authorize';
import { fetchEffectivePermissions } from './core/permissions/effective-permissions';
import { createAuthRoutes, requireAuthMiddleware } from './core/http/api/auth';
import { registerUserRoutes } from './core/http/api/users';
import { registerPermissionRoutes } from './core/http/api/permissions';
import { registerContextRoutes } from './core/http/api/contexts';
import { registerRoleRoutes } from './core/http/api/roles';
import { defaultRoutePermissionPolicy, type RoutePermissionPolicy } from './core/policy/policy';
import { ServiceFactory, getServiceFactory, setServiceFactory } from './core/services';
import { db } from './core/db/db-client';

export type SupportedAdapter = 'fastify' | 'express';

export interface CoreConfig {
  db: { provider: 'postgres' | 'sqlite'; url?: string };
  adapter: SupportedAdapter;
  jwt: { accessTTL: string; refreshTTL: string; secret?: string };
  policy?: RoutePermissionPolicy;
}

export interface RouteDefinition<Body = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  preHandler?: Array<unknown> | unknown;
  handler: (args: {
    user: { id: string } | null;
    context: { id: string } | null;
    body: Body;
    params: Record<string, string>;
    query: Record<string, string | string[]>;
    req: any;
  }) => Promise<unknown> | unknown;
}

export interface PluginPermission {
  key: string;
  label?: string;
  plugin?: string;
}

export interface LatticePlugin {
  name: string;
  permissions?: PluginPermission[];
  register?: (app: CoreSaaSApp) => void | Promise<void>;
}

export interface CheckAccessInput {
  userId: string;
  context?: { type: string; id: string } | null;
  permission: string;
  scope?: 'exact' | 'global' | 'type-wide';
  contextType?: string;
}

export interface HttpAdapter {
  addRoute: (route: RouteDefinition) => void;
  listen: (port: number, host?: string) => Promise<void>;
  getUnderlying: () => unknown;
}

export class CoreSaaSApp {
  public readonly permissionRegistry: PermissionRegistry;
  public readonly PermissionRegistry: PermissionRegistry;
  private readonly adapterKind: SupportedAdapter;
  private readonly httpAdapter: HttpAdapter;
  private readonly policy: RoutePermissionPolicy;
  private readonly serviceFactory: ServiceFactory;
  private readonly config: CoreConfig;

  constructor(config: CoreConfig) {
    this.config = config;
    this.permissionRegistry = new PermissionRegistry();
    this.PermissionRegistry = this.permissionRegistry;
    this.adapterKind = config.adapter;
    this.httpAdapter =
      config.adapter === 'fastify'
        ? createFastifyAdapter(this)
        : createExpressAdapter(this);
    this.policy = {
      users: { ...defaultRoutePermissionPolicy.users, ...(config.policy?.users ?? {}) },
      permissions: { ...defaultRoutePermissionPolicy.permissions, ...(config.policy?.permissions ?? {}) },
      contexts: { ...defaultRoutePermissionPolicy.contexts, ...(config.policy?.contexts ?? {}) },
    } as Required<RoutePermissionPolicy>;

    // Initialize service factory with configuration
    this.serviceFactory = new ServiceFactory({
      db
    });

    // Set global service factory for application-wide access
    setServiceFactory(this.serviceFactory);
  }

  /**
   * Get the JWT configuration
   */
  public get jwtConfig() {
    return this.config.jwt;
  }

  /**
   * Get the service factory instance
   */
  public get services(): ServiceFactory {
    return this.serviceFactory;
  }

  /**
   * Get the context service instance
   */
  public get contextService() {
    return this.serviceFactory.getContextService();
  }

  /**
   * Get the role service instance
   */
  public get roleService() {
    return this.serviceFactory.getRoleService();
  }

  /**
   * Get the user service instance
   */
  public get userService() {
    return this.serviceFactory.getUserService();
  }

  /**
   * Get the permission service instance
   */
  public get permissionService() {
    return this.serviceFactory.getPermissionService();
  }

  public get express(): ReturnType<ExpressHttpAdapter['getUnderlying']> | undefined {
    return this.adapterKind === 'express'
      ? (this.httpAdapter as ExpressHttpAdapter).getUnderlying()
      : undefined;
  }

  public get fastify(): ReturnType<FastifyHttpAdapter['getUnderlying']> | undefined {
    return this.adapterKind === 'fastify'
      ? (this.httpAdapter as FastifyHttpAdapter).getUnderlying()
      : undefined;
  }

  public route(def: RouteDefinition): void {
    this.httpAdapter.addRoute(def);
  }

  public authorize(requiredPermission: string, options?: AuthorizeOptions) {
    return createAuthorize(this, requiredPermission, options);
  }

  public requireAuth() {
    return requireAuthMiddleware(this);
  }

  public async checkAccess(input: CheckAccessInput): Promise<boolean> {
    const { userId, context, permission, scope, contextType } = input;

    let lookupContext = context ?? null;
    if (scope === 'global') {
      lookupContext = null;
    } else if (scope === 'type-wide') {
      lookupContext = contextType ? { type: contextType, id: null } : context;
    }

    try {
      const effective = await fetchEffectivePermissions({ userId, context: lookupContext });
      return this.permissionRegistry.isAllowed(permission, effective);
    } catch (error) {
      console.error('Failed to fetch effective permissions:', error);
      return false;
    }
  }

  // Remove the in-memory grantUserPermission function - everything should be DB-driven
  // public grantUserPermission(userId: string, permission: string, contextId?: string): void { ... }

  public registerPlugin(plugin: LatticePlugin): void {
    if (plugin.permissions) {
      for (const p of plugin.permissions) {
        this.permissionRegistry.register({ key: p.key, label: p.label ?? p.key, plugin: plugin.name });
      }
    }
    if (plugin.register) {
      plugin.register(this);
    }
  }

  public async listen(port: number, host: string = '0.0.0.0'): Promise<void> {
    await this.permissionRegistry.initFromDatabase();
    await this.permissionRegistry.syncToDatabase();
    
    // Global request context middleware (only for adapters that support preHandler arrays at route-level)
    // Developers should add it before their own routes if using adapter directly.
    createAuthRoutes(this);
    registerUserRoutes(this, this.policy);
    registerPermissionRoutes(this, this.policy);
    registerContextRoutes(this, this.policy);
    registerRoleRoutes(this, this.policy);
    
    await this.httpAdapter.listen(port, host);
  }

  /**
   * Gracefully shutdown the application and all services
   */
  public async shutdown(): Promise<void> {
    await this.serviceFactory.shutdown();
  }
}

export function CoreSaaS(config: CoreConfig): CoreSaaSApp {
  return new CoreSaaSApp(config);
}

export type { PermissionRegistry };


