import { createFastifyAdapter, type FastifyHttpAdapter } from './core/http/adapters/fastify-adapter';
import { createExpressAdapter, type ExpressHttpAdapter } from './core/http/adapters/express-adapter';
import { PermissionRegistry } from './core/permissions/permission-registry';
import { ContextService } from './core/services/context-service';
import { createAuthorize, type AuthorizeOptions } from './core/http/authorize';
import { fetchEffectivePermissions } from './core/permissions/effective-permissions';
import { createAuthRoutes, requireAuthMiddleware } from './core/http/api/auth';
import { AuditService } from './core/services/audit-service';
import { registerUserRoutes } from './core/http/api/users';
import { registerPermissionRoutes } from './core/http/api/permissions';
import { registerContextRoutes } from './core/http/api/contexts';
import { registerRoleRoutes } from './core/http/api/roles';
import { defaultRoutePermissionPolicy, type RoutePermissionPolicy } from './core/policy/policy';

export type SupportedAdapter = 'fastify' | 'express';

export interface CoreConfig {
  db: { provider: 'postgres' | 'sqlite'; url?: string };
  adapter: SupportedAdapter;
  jwt: { accessTTL: string; refreshTTL: string; secret?: string };
  audit?: { enabled: boolean };
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
  public readonly contextService: ContextService;
  public readonly auditService: AuditService;
  private readonly adapterKind: SupportedAdapter;
  private readonly httpAdapter: HttpAdapter;
  private readonly policy: RoutePermissionPolicy;

  private readonly userGrants: Map<string, Set<string>> = new Map();
  private readonly userContextGrants: Map<string, Map<string, Set<string>>> = new Map();

  constructor(config: CoreConfig) {
    this.permissionRegistry = new PermissionRegistry();
    this.PermissionRegistry = this.permissionRegistry;
    this.contextService = new ContextService();
    this.auditService = new AuditService(config.audit?.enabled !== false);
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
}

export function CoreSaaS(config: CoreConfig): CoreSaaSApp {
  return new CoreSaaSApp(config);
}

export type { PermissionRegistry };


