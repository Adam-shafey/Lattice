"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LatticeCore = void 0;
exports.Lattice = Lattice;
const fastify_adapter_1 = require("./core/http/adapters/fastify-adapter");
const express_adapter_1 = require("./core/http/adapters/express-adapter");
const permission_registry_1 = require("./core/permissions/permission-registry");
const authorize_1 = require("./core/http/authorize");
const effective_permissions_1 = require("./core/permissions/effective-permissions");
const auth_1 = require("./core/http/api/auth");
const users_1 = require("./core/http/api/users");
const permissions_1 = require("./core/http/api/permissions");
const contexts_1 = require("./core/http/api/contexts");
const roles_1 = require("./core/http/api/roles");
const policies_1 = require("./core/http/api/policies");
const policy_1 = require("./core/policy/policy");
const services_1 = require("./core/services");
const db_client_1 = require("./core/db/db-client");
const logger_1 = require("./core/logger");
const abac_1 = require("./core/abac/abac");
class LatticeCore {
    constructor(config) {
        this.config = config;
        this.apiPrefix = config.apiPrefix ?? '';
        this.dbClient = db_client_1.db;
        this.permissionRegistry = new permission_registry_1.PermissionRegistry(this.dbClient);
        this.adapterKind = config.adapter;
        this.httpAdapter =
            config.adapter === 'fastify'
                ? (0, fastify_adapter_1.createFastifyAdapter)(this)
                : (0, express_adapter_1.createExpressAdapter)(this);
        this.policy = {
            roles: { ...policy_1.defaultRoutePermissionPolicy.roles, ...(config.policy?.roles ?? {}) },
            users: { ...policy_1.defaultRoutePermissionPolicy.users, ...(config.policy?.users ?? {}) },
            permissions: { ...policy_1.defaultRoutePermissionPolicy.permissions, ...(config.policy?.permissions ?? {}) },
            contexts: { ...policy_1.defaultRoutePermissionPolicy.contexts, ...(config.policy?.contexts ?? {}) },
        };
        this.enableAuthn = config.authn !== false;
        this.enableAuthz = config.authz !== false;
        // Initialize service factory with shared permission registry
        this.serviceFactory = new services_1.ServiceFactory({
            db: this.dbClient,
            permissionRegistry: this.permissionRegistry,
        });
        // Set global service factory for application-wide access
        (0, services_1.setServiceFactory)(this.serviceFactory);
    }
    /**
     * Get the JWT configuration
     */
    get jwtConfig() {
        return this.config.jwt;
    }
    /**
     * Whether route authentication (JWT verification) is enabled
     */
    get authnEnabled() {
        return this.enableAuthn;
    }
    /**
     * Whether route authorization is enabled
     */
    get authzEnabled() {
        return this.enableAuthz;
    }
    /**
     * Get the route permission policy
     */
    get routePolicy() {
        return this.policy;
    }
    /**
     * Build pre-handlers for authentication and authorization based on config
     */
    routeAuth(permission, options) {
        const handlers = [];
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
    get services() {
        return this.serviceFactory;
    }
    /**
     * Get the underlying database client
     */
    get db() {
        return this.dbClient;
    }
    get apiBase() {
        return this.apiPrefix;
    }
    /**
     * Get the context service instance
     */
    get contextService() {
        return this.serviceFactory.getContextService();
    }
    /**
     * Get the role service instance
     */
    get roleService() {
        return this.serviceFactory.getRoleService();
    }
    /**
     * Get the user service instance
     */
    get userService() {
        return this.serviceFactory.getUserService();
    }
    /**
     * Get the permission service instance
     */
    get permissionService() {
        return this.serviceFactory.getPermissionService();
    }
    /**
     * Get the ABAC policy service instance
     */
    get policyService() {
        return this.serviceFactory.getPolicyService();
    }
    get express() {
        return this.adapterKind === 'express'
            ? this.httpAdapter.getUnderlying()
            : undefined;
    }
    get fastify() {
        return this.adapterKind === 'fastify'
            ? this.httpAdapter.getUnderlying()
            : undefined;
    }
    route(def) {
        this.httpAdapter.addRoute(def);
    }
    authorize(requiredPermission, options) {
        return (0, authorize_1.createAuthorize)(this, requiredPermission, options);
    }
    requireAuth() {
        return (0, auth_1.requireAuthMiddleware)(this);
    }
    async checkAccess(input) {
        logger_1.logger.log('🔍 [CHECK_ACCESS] Starting checkAccess');
        logger_1.logger.log('🔍 [CHECK_ACCESS] Input:', input);
        const { userId, context, permission, scope, contextType } = input;
        let lookupContext = context ?? null;
        if (scope === 'global') {
            lookupContext = null;
            logger_1.logger.log('🔍 [CHECK_ACCESS] Global scope - setting lookupContext to null');
        }
        else if (scope === 'type-wide') {
            lookupContext = contextType ? { type: contextType, id: null } : (context ?? null);
            logger_1.logger.log('🔍 [CHECK_ACCESS] Type-wide scope - setting lookupContext to:', lookupContext);
        }
        else {
            logger_1.logger.log('🔍 [CHECK_ACCESS] Exact scope or undefined - using provided context:', lookupContext);
        }
        logger_1.logger.log('🔍 [CHECK_ACCESS] Final lookupContext:', lookupContext);
        try {
            logger_1.logger.log('🔍 [CHECK_ACCESS] Calling fetchEffectivePermissions');
            const effective = await (0, effective_permissions_1.fetchEffectivePermissions)(this.dbClient, { userId, context: lookupContext });
            logger_1.logger.log('🔍 [CHECK_ACCESS] fetchEffectivePermissions result - permissions count:', effective.size);
            logger_1.logger.log('🔍 [CHECK_ACCESS] Effective permissions:', Array.from(effective));
            logger_1.logger.log('🔍 [CHECK_ACCESS] Calling permissionRegistry.isAllowed');
            const rbacAllowed = this.permissionRegistry.isAllowed(permission, effective);
            logger_1.logger.log('🔍 [CHECK_ACCESS] permissionRegistry.isAllowed result:', rbacAllowed);
            if (!rbacAllowed) {
                return false;
            }
            logger_1.logger.log('🔍 [CHECK_ACCESS] Evaluating ABAC policies');
            const abacAllowed = await (0, abac_1.evaluateAbac)(this.policyService, new abac_1.DefaultAttributeProvider(), {
                action: permission,
                resource: lookupContext?.type ?? contextType ?? 'unknown',
                resourceId: lookupContext?.id ?? null,
                userId,
            });
            logger_1.logger.log('🔍 [CHECK_ACCESS] ABAC evaluation result:', abacAllowed);
            return abacAllowed;
        }
        catch (error) {
            logger_1.logger.error('🔍 [CHECK_ACCESS] ❌ Error during checkAccess:', error);
            logger_1.logger.error('Failed to fetch effective permissions:', error);
            return false;
        }
    }
    // Note: All permission management is now DB-driven through the permission service
    registerPlugin(plugin) {
        if (plugin.permissions) {
            for (const p of plugin.permissions) {
                this.permissionRegistry.register({ key: p.key, label: p.label ?? p.key, plugin: plugin.name });
            }
        }
        if (plugin.register) {
            plugin.register(this);
        }
    }
    async listen(port, host = '0.0.0.0') {
        await this.permissionRegistry.initFromDatabase();
        await this.permissionRegistry.syncToDatabase();
        if (this.config.exposeAPI) {
            // Global request context middleware (only for adapters that support preHandler arrays at route-level)
            // Developers should add it before their own routes if using adapter directly.
            (0, auth_1.createAuthRoutes)(this, this.apiPrefix);
            (0, users_1.registerUserRoutes)(this, this.apiPrefix);
            (0, permissions_1.registerPermissionRoutes)(this, this.apiPrefix);
            (0, contexts_1.registerContextRoutes)(this, this.apiPrefix);
            (0, roles_1.registerRoleRoutes)(this, this.apiPrefix);
            (0, policies_1.registerPolicyRoutes)(this, this.apiPrefix);
        }
        await this.httpAdapter.listen(port, host);
    }
    /**
     * Gracefully shutdown the application and all services
     */
    async shutdown() {
        await this.serviceFactory.shutdown();
    }
}
exports.LatticeCore = LatticeCore;
const defaultConfig = {
    db: { provider: 'sqlite' },
    adapter: 'fastify',
    jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'dev-secret' },
    exposeAPI: false,
};
function Lattice(config = {}) {
    const finalConfig = {
        ...defaultConfig,
        ...config,
        db: { ...defaultConfig.db, ...(config.db ?? {}) },
        jwt: { ...defaultConfig.jwt, ...(config.jwt ?? {}) },
    };
    return new LatticeCore(finalConfig);
}
