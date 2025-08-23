import { type FastifyHttpAdapter } from './core/http/adapters/fastify-adapter';
import { type ExpressHttpAdapter } from './core/http/adapters/express-adapter';
import { PermissionRegistry } from './core/permissions/permission-registry';
import { type AuthorizeOptions } from './core/http/authorize';
import { type RoutePermissionPolicy } from './core/policy/policy';
import { ServiceFactory } from './core/services';
import { type PrismaClient } from './core/db/db-client';
export type SupportedAdapter = 'fastify' | 'express';
export interface ApiConfig {
    /**
     * Automatically register built-in API routes when listening
     * Defaults to true
     */
    exposeAPI?: boolean;
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
    /**
     * Prefix to apply to all built-in API routes
     * Defaults to ''
     */
    apiPrefix?: string;
}
export interface CoreConfig {
    db: {
        provider: 'postgres' | 'sqlite';
        url?: string;
    };
    adapter: SupportedAdapter;
    jwt: {
        accessTTL: string;
        refreshTTL: string;
        secret?: string;
    };
    policy?: RoutePermissionPolicy;
    /**
     * API related configuration including exposure and auth settings
     */
    apiConfig?: ApiConfig;
}
export interface RouteDefinition<Body = unknown> {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    preHandler?: Array<unknown> | unknown;
    config?: unknown;
    handler: (args: {
        user: {
            id: string;
        } | null;
        context: {
            id: string;
        } | null;
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
    context?: {
        type: string;
        id: string | null;
    } | null;
    permission: string;
    scope?: 'exact' | 'global' | 'type-wide';
    contextType?: string | null;
}
export interface HttpAdapter {
    addRoute: (route: RouteDefinition) => void;
    listen: (port: number, host?: string) => Promise<void>;
    getUnderlying: () => unknown;
}
export declare class LatticeCore {
    readonly permissionRegistry: PermissionRegistry;
    private readonly adapterKind;
    private readonly httpAdapter;
    private readonly policy;
    private readonly serviceFactory;
    private readonly config;
    private readonly apiPrefix;
    private readonly enableAuthn;
    private readonly enableAuthz;
    private readonly dbClient;
    constructor(config: CoreConfig);
    /**
     * Get the JWT configuration
     */
    get jwtConfig(): {
        accessTTL: string;
        refreshTTL: string;
        secret?: string;
    };
    /**
     * Whether route authentication (JWT verification) is enabled
     */
    get authnEnabled(): boolean;
    /**
     * Whether route authorization is enabled
     */
    get authzEnabled(): boolean;
    /**
     * Get the route permission policy
     */
    get routePolicy(): Required<RoutePermissionPolicy>;
    /**
     * Build pre-handlers for authentication and authorization based on config
     */
    routeAuth(permission?: string, options?: AuthorizeOptions): any[] | undefined;
    /**
     * Get the service factory instance
     */
    get services(): ServiceFactory;
    /**
     * Get the underlying database client
     */
    get db(): PrismaClient;
    get apiBase(): string;
    /**
     * Get the context service instance
     */
    get contextService(): import("./core/services").IContextService;
    /**
     * Get the role service instance
     */
    get roleService(): import("./core/services").IRoleService;
    /**
     * Get the user service instance
     */
    get userService(): import("./core/services").IUserService;
    /**
     * Get the permission service instance
     */
    get permissionService(): import("./core/services").IPermissionService;
    /**
     * Get the ABAC policy service instance
     */
    get policyService(): import("./core/services").IPolicyService;
    get express(): ReturnType<ExpressHttpAdapter['getUnderlying']> | undefined;
    get fastify(): ReturnType<FastifyHttpAdapter['getUnderlying']> | undefined;
    route(def: RouteDefinition): void;
    authorize(requiredPermission: string, options?: AuthorizeOptions): (req: any, res: any, next?: (err?: any) => void) => Promise<any>;
    requireAuth(): (req: any, res: any, next?: (err?: any) => void) => Promise<any>;
    checkAccess(input: CheckAccessInput): Promise<boolean>;
    registerPlugin(plugin: LatticePlugin): void;
    listen(port: number, host?: string): Promise<void>;
    /**
     * Gracefully shutdown the application and all services
     */
    shutdown(): Promise<void>;
}
export declare function Lattice(config?: Partial<CoreConfig>): LatticeCore;
export type { PermissionRegistry };
