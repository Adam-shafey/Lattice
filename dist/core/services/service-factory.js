"use strict";
/**
 * Service Factory for Lattice Core
 *
 * This file implements the factory pattern for creating and managing service instances.
 * The ServiceFactory provides centralized service management with dependency injection,
 * lazy loading, and graceful shutdown capabilities.
 *
 * Key Features:
 * - Singleton pattern for global access
 * - Lazy loading of services (created on-demand)
 * - Dependency injection for the database
 * - Graceful shutdown of all services
 * - Testing support with reset capabilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceFactory = void 0;
exports.getServiceFactory = getServiceFactory;
exports.setServiceFactory = setServiceFactory;
exports.resetServiceFactory = resetServiceFactory;
const context_service_1 = require("./context-service");
const role_service_1 = require("./role-service");
const user_permission_service_1 = require("./user-permission-service");
const user_service_1 = require("./user-service");
const policy_service_1 = require("./policy-service");
/**
 * ServiceFactory Class
 *
 * Centralized factory for creating and managing all service instances.
 * Implements lazy loading to create services only when needed, reducing
 * memory usage and startup time.
 *
 * Usage:
 * const factory = new ServiceFactory({ db: prismaClient, permissionRegistry });
 * const roleService = factory.getRoleService();
 */
class ServiceFactory {
    /**
     * Constructor for ServiceFactory
     * @param config - Configuration object containing the database client
     */
    constructor(config) {
        this.db = config.db;
        this.permissionRegistry = config.permissionRegistry;
    }
    /**
     * Gets the context service instance (lazy-loaded)
     *
     * Creates the context service on first access and reuses the same instance
     * for subsequent calls. The service is configured with the shared database
     * client.
     *
     * @returns IContextService instance
     */
    getContextService() {
        if (!this._contextService) {
            this._contextService = new context_service_1.ContextService(this.db);
        }
        return this._contextService;
    }
    /**
     * Gets the role service instance (lazy-loaded)
     *
     * Creates the role service on first access and reuses the same instance
     * for subsequent calls. The service is configured with the shared database
     * client.
     *
     * @returns IRoleService instance
     */
    getRoleService() {
        if (!this._roleService) {
            this._roleService = new role_service_1.RoleService(this.db);
        }
        return this._roleService;
    }
    /**
     * Gets the permission service instance (lazy-loaded)
     *
     * Creates the user permission service on first access and reuses the same
     * instance for subsequent calls. The service is configured with the shared
     * database client.
     *
     * @returns IPermissionService instance
     */
    getPermissionService() {
        if (!this._userPermissionService) {
            this._userPermissionService = new user_permission_service_1.UserPermissionService(this.db, this.permissionRegistry);
        }
        return this._userPermissionService;
    }
    /**
     * Gets the user service instance (lazy-loaded)
     *
     * Creates the user service on first access and reuses the same instance
     * for subsequent calls. The service is configured with the shared database
     * client.
     *
     * @returns IUserService instance
     */
    getUserService() {
        if (!this._userService) {
            this._userService = new user_service_1.UserService(this.db);
        }
        return this._userService;
    }
    /**
     * Gets the ABAC policy service instance (lazy-loaded)
     * @returns IPolicyService instance
     */
    getPolicyService() {
        if (!this._policyService) {
            this._policyService = new policy_service_1.PolicyService(this.db);
        }
        return this._policyService;
    }
    /**
     * Gets all service instances at once
     *
     * Convenience method to retrieve all available services in a single call.
     * Useful for dependency injection or when multiple services are needed.
     *
     * @returns Object containing all service instances
     */
    getAllServices() {
        return {
            context: this.getContextService(),
            role: this.getRoleService(),
            permission: this.getPermissionService(),
            user: this.getUserService(),
            policy: this.getPolicyService(),
        };
    }
    /**
     * Gracefully shuts down all services
     *
     * This method ensures that all services are properly cleaned up.
     * Should be called during application shutdown.
     *
     * @returns Promise that resolves when all services are shut down
     */
    async shutdown() {
        // Disconnect the database client
        await this.db.$disconnect();
    }
    /**
     * Resets all service instances (useful for testing)
     *
     * Clears all cached service instances, forcing them to be recreated
     * on next access. This is particularly useful for testing to ensure
     * clean state between tests.
     */
    reset() {
        this._contextService = undefined;
        this._roleService = undefined;
        this._userPermissionService = undefined;
        this._userService = undefined;
        this._policyService = undefined;
    }
}
exports.ServiceFactory = ServiceFactory;
/**
 * Global singleton instance of ServiceFactory
 *
 * This variable holds the global service factory instance for
 * application-wide access. It's initialized on first use and
 * can be reset for testing purposes.
 */
let globalServiceFactory = null;
/**
 * Gets the global service factory instance
 *
 * This function provides access to the global service factory singleton.
 * If the factory hasn't been initialized yet, it must be provided with
 * configuration on the first call.
 *
 * @param config - Optional configuration for initializing the factory
 * @returns ServiceFactory instance
 * @throws Error if factory is not initialized and no config is provided
 *
 * Usage:
 * // Initialize the global factory
 * getServiceFactory({ db: prismaClient });
 *
 * // Use the global factory anywhere in the application
 * const factory = getServiceFactory();
 * const roleService = factory.getRoleService();
 */
function getServiceFactory(config) {
    if (!globalServiceFactory) {
        if (!config) {
            throw new Error('ServiceFactory must be initialized with config before use');
        }
        globalServiceFactory = new ServiceFactory(config);
    }
    return globalServiceFactory;
}
/**
 * Sets the global service factory instance
 *
 * This function allows setting a custom service factory instance,
 * which is useful for testing or when you need to provide a mock
 * factory implementation.
 *
 * @param factory - ServiceFactory instance to set as global
 */
function setServiceFactory(factory) {
    globalServiceFactory = factory;
}
/**
 * Resets the global service factory instance
 *
 * This function clears the global service factory instance, forcing
 * it to be reinitialized on next access. This is useful for testing
 * to ensure clean state between tests.
 */
function resetServiceFactory() {
    globalServiceFactory = null;
}
