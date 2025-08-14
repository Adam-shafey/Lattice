import { createFastifyAdapter, type FastifyHttpAdapter } from './core/http/adapters/fastify-adapter';
import { createExpressAdapter, type ExpressHttpAdapter } from './core/http/adapters/express-adapter';
import { PermissionRegistry } from './core/permissions/permission-registry';
import { ContextService } from './core/context/context-service';
import { createAuthorize } from './core/http/middlewares/authz-middleware';
import { fetchEffectivePermissions } from './core/permissions/effective-permissions';
import { createAuthRoutes, requireAuthMiddleware } from './core/auth/routes';
import { AuditService } from './core/audit/audit-service';

export type SupportedAdapter = 'fastify' | 'express';

export interface CoreConfig {
  db: { provider: 'postgres' | 'sqlite'; url?: string };
  adapter: SupportedAdapter;
  jwt: { accessTTL: string; refreshTTL: string; secret?: string };
  audit?: { enabled: boolean };
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
  contextId?: string | null;
  permission: string;
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

  public authorize(requiredPermission: string, options?: { contextRequired?: boolean }) {
    return createAuthorize(this, requiredPermission, options);
  }

  public requireAuth() {
    return requireAuthMiddleware();
  }

  public async checkAccess(input: CheckAccessInput): Promise<boolean> {
    const { userId, contextId, permission } = input;
    const effective = await fetchEffectivePermissions({ userId, contextId: contextId ?? null });
    const merged = new Set<string>([...effective]);
    const global = this.userGrants.get(userId);
    if (global) for (const p of global) merged.add(p);
    if (contextId) {
      const byUser = this.userContextGrants.get(userId)?.get(contextId);
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
    createAuthRoutes(this);
    await this.httpAdapter.listen(port, host);
  }
}

export function CoreSaaS(config: CoreConfig): CoreSaaSApp {
  return new CoreSaaSApp(config);
}

export type { PermissionRegistry };


