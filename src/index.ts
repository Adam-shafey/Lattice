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
import { registerPolicyRoutes } from './core/http/api/policies';
import { defaultRoutePermissionPolicy, type RoutePermissionPolicy } from './core/policy/policy';
import { ServiceFactory, setServiceFactory } from './core/services';
import { db as dbClient, type PrismaClient } from './core/db/db-client';
import { logger } from './core/logger';
import { evaluateAbac, DefaultAttributeProvider } from './core/abac/abac';

export type SupportedAdapter = 'fastify' | 'express';

export interface CoreConfig {
  db: { provider: 'postgres' | 'sqlite'; url?: string };
  adapter: SupportedAdapter;
  jwt: { accessTTL: string; refreshTTL: string; secret?: string };
  /**
   * Enable route-level authentication (JWT verification)
   * Defaults to true
   */
  authn?: boolean;
  /**
   * Enable route-level authorization checks
   * Defaults to true
   */
  authz?: boolean;
  policy?: RoutePermissionPolicy;
  apiPrefix?: string;
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
  register?: (app: LatticeCore) => void | Promise<void>;
}

export interface CheckAccessInput {
  userId: string;
  context?: { type: string; id: string | null } | null;
  permission: string;
  scope?: 'exact' | 'global' | 'type-wide';
  contextType?: string | null;
}

export interface HttpAdapter {
  addRoute: (route: RouteDefinition) => void;
  listen: (port: number, host?: string) => Promise<void>;
  getUnderlying: () => unknown;
}

export class LatticeCore {
  public readonly permissionRegistry: PermissionRegistry;
  private readonly adapterKind: SupportedAdapter;
  private readonly httpAdapter: HttpAdapter;
  private readonly policy: RoutePermissionPolicy;
  private readonly serviceFactory: ServiceFactory;
  private readonly config: CoreConfig;
  private readonly apiPrefix: string;
  private readonly enableAuthn: boolean;
  private readonly enableAuthz: boolean;
  private readonly dbClient: PrismaClient;

  constructor(config: CoreConfig) {
    this.config = config;
    this.apiPrefix = config.apiPrefix ?? '';
    this.dbClient = dbClient;
    this.permissionRegistry = new PermissionRegistry(this.dbClient);
    this.adapterKind = config.adapter;
    this.httpAdapter =
      config.adapter === 'fastify'
        ? createFastifyAdapter(this)
        : createExpressAdapter(this);
    this.policy = {
      roles: { ...defaultRoutePermissionPolicy.roles, ...(config.policy?.roles ?? {}) },
      users: { ...defaultRoutePermissionPolicy.users, ...(config.policy?.users ?? {}) },
      permissions: { ...defaultRoutePermissionPolicy.permissions, ...(config.policy?.permissions ?? {}) },
      contexts: { ...defaultRoutePermissionPolicy.contexts, ...(config.policy?.contexts ?? {}) },
    } as Required<RoutePermissionPolicy>;

    this.enableAuthn = config.authn !== false;
    this.enableAuthz = config.authz !== false;

    // Initialize service factory with configuration
    this.serviceFactory = new ServiceFactory({
      db: this.dbClient,
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
   * Whether route authentication (JWT verification) is enabled
   */
  public get authnEnabled(): boolean {
    return this.enableAuthn;
  }

  /**
   * Whether route authorization is enabled
   */
  public get authzEnabled(): boolean {
    return this.enableAuthz;
  }

  /**
   * Get the route permission policy
   */
  public get routePolicy(): Required<RoutePermissionPolicy> {
    return this.policy as Required<RoutePermissionPolicy>;
  }

  /**
   * Build pre-handlers for authentication and authorization based on config
   */
  public routeAuth(permission?: string, options?: AuthorizeOptions) {
    const handlers: any[] = [];
    if (this.enableAuthn) {
      handlers.push(this.requireAuth());
    }
    if (permission && this.enableAuthz) {
      handlers.push(this.authorize(permission, options));
    }
    return handlers.length > 0 ? handlers : undefined;
  }

  /**
   * Get the service factory instance
   */
  public get services(): ServiceFactory {
    return this.serviceFactory;
  }

  /**
   * Get the underlying database client
   */
  public get db(): PrismaClient {
    return this.dbClient;
  }

  public get apiBase(): string {
    return this.apiPrefix;
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

  /**
   * Get the ABAC policy service instance
   */
  public get policyService() {
    return this.serviceFactory.getPolicyService();
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
    logger.log('🔍 [CHECK_ACCESS] Starting checkAccess');
    logger.log('🔍 [CHECK_ACCESS] Input:', input);
    
    const { userId, context, permission, scope, contextType } = input;

    let lookupContext: { type: string; id: string | null } | null = context ?? null;
    if (scope === 'global') {
      lookupContext = null;
      logger.log('🔍 [CHECK_ACCESS] Global scope - setting lookupContext to null');
    } else if (scope === 'type-wide') {
      lookupContext = contextType ? { type: contextType, id: null } : (context ?? null);
      logger.log('🔍 [CHECK_ACCESS] Type-wide scope - setting lookupContext to:', lookupContext);
    } else {
      logger.log('🔍 [CHECK_ACCESS] Exact scope or undefined - using provided context:', lookupContext);
    }

    logger.log('🔍 [CHECK_ACCESS] Final lookupContext:', lookupContext);

    try {
      logger.log('🔍 [CHECK_ACCESS] Calling fetchEffectivePermissions');
      const effective = await fetchEffectivePermissions(this.dbClient, { userId, context: lookupContext });
      logger.log('🔍 [CHECK_ACCESS] fetchEffectivePermissions result - permissions count:', effective.size);
      logger.log('🔍 [CHECK_ACCESS] Effective permissions:', Array.from(effective));
      
      logger.log('🔍 [CHECK_ACCESS] Calling permissionRegistry.isAllowed');
      const rbacAllowed = this.permissionRegistry.isAllowed(permission, effective);
      logger.log('🔍 [CHECK_ACCESS] permissionRegistry.isAllowed result:', rbacAllowed);

      if (!rbacAllowed) {
        return false;
      }

      logger.log('🔍 [CHECK_ACCESS] Evaluating ABAC policies');
      const abacAllowed = await evaluateAbac(
        this.policyService,
        new DefaultAttributeProvider(),
        {
          action: permission,
          resource: lookupContext?.type ?? contextType ?? 'unknown',
          resourceId: lookupContext?.id ?? null,
          userId,
        }
      );
      logger.log('🔍 [CHECK_ACCESS] ABAC evaluation result:', abacAllowed);

      return abacAllowed;
    } catch (error) {
      logger.error('🔍 [CHECK_ACCESS] ❌ Error during checkAccess:', error);
      logger.error('Failed to fetch effective permissions:', error);
      return false;
    }
  }

  // Note: All permission management is now DB-driven through the permission service

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
    createAuthRoutes(this, this.apiPrefix);
    registerUserRoutes(this, this.apiPrefix);
    registerPermissionRoutes(this, this.apiPrefix);
    registerContextRoutes(this, this.apiPrefix);
    registerRoleRoutes(this, this.apiPrefix);
    registerPolicyRoutes(this, this.apiPrefix);
    
    await this.httpAdapter.listen(port, host);
  }

  /**
   * Gracefully shutdown the application and all services
   */
  public async shutdown(): Promise<void> {
    await this.serviceFactory.shutdown();
  }
}

export function Lattice(config: CoreConfig): LatticeCore {
  return new LatticeCore(config);
}

export type { PermissionRegistry };


