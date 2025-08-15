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
  audit?: { 
    enabled?: boolean;
    sampleRate?: number;
    sinks?: ('db' | 'stdout')[];
    batchSize?: number;
    flushInterval?: number;
    redactKeys?: string[];
  };
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
  requireGlobal?: boolean;
  requireTypeWide?: boolean;
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

  private readonly userGrants: Map<string, Set<string>> = new Map();
  private readonly userContextGrants: Map<string, Map<string, Set<string>>> = new Map();

  constructor(config: CoreConfig) {
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
      db,
      audit: {
        enabled: config.audit?.enabled !== false,
        sampleRate: config.audit?.sampleRate ?? 1.0,
        sinks: config.audit?.sinks ?? ['db'],
        batchSize: config.audit?.batchSize ?? 100,
        flushInterval: config.audit?.flushInterval ?? 5000,
        redactKeys: config.audit?.redactKeys ?? ['password', 'token', 'secret']
      }
    });

    // Set global service factory for application-wide access
    setServiceFactory(this.serviceFactory);
  }

  /**
   * Get the service factory instance
   */
  public get services(): ServiceFactory {
    return this.serviceFactory;
  }

  /**
   * Get the audit service instance
   */
  public get auditService() {
    return this.serviceFactory.auditService;
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
    // Wrap handler to inject request-context to audit logs
    this.httpAdapter.addRoute(def);
  }

  public authorize(requiredPermission: string, options?: AuthorizeOptions) {
    return createAuthorize(this, requiredPermission, options);
  }

  public requireAuth() {
    return requireAuthMiddleware();
  }

  public async checkAccess(input: CheckAccessInput): Promise<boolean> {
    const { userId, context, permission } = input;
    let effective: Set<string> = new Set();
    try {
      effective = await fetchEffectivePermissions({ userId, context: context ?? null });
    } catch {
      // If DB lookup fails (e.g., tests without DB), fall back to empty set
      effective = new Set();
    }
    const merged = new Set<string>([...effective]);
    const global = this.userGrants.get(userId);
    if (global) for (const p of global) merged.add(p);
    if (context?.id) {
      const byUser = this.userContextGrants.get(userId)?.get(context.id);
      if (byUser) for (const p of byUser) merged.add(p);
    }
    return this.permissionRegistry.isAllowed(permission, merged);
  }

  public grantUserPermission(userId: string, permission: string, contextId?: string): void {
    if (contextId) {
      let perUser = this.userContextGrants.get(userId);
      if (!perUser) {
        perUser = new Map();
        this.userContextGrants.set(userId, perUser);
      }
      let perContext = perUser.get(contextId);
      if (!perContext) {
        perContext = new Set();
        perUser.set(contextId, perContext);
      }
      perContext.add(permission);
      return;
    }
    let set = this.userGrants.get(userId);
    if (!set) {
      set = new Set();
      this.userGrants.set(userId, set);
    }
    set.add(permission);
  }

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


