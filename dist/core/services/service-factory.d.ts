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
import type { PrismaClient } from '../db/db-client';
import { PermissionRegistry } from '../permissions/permission-registry';
import { IServiceFactory, type IUserService, type IRoleService, type IPermissionService, type IContextService, type IPolicyService } from './interfaces';
/**
 * Configuration interface for ServiceFactory
 *
 * Defines the required and optional configuration parameters
 * for initializing the service factory.
 */
export interface ServiceFactoryConfig {
    /** Database client instance for all services */
    db: PrismaClient;
    /** Shared permission registry instance */
    permissionRegistry: PermissionRegistry;
}
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
export declare class ServiceFactory implements IServiceFactory {
    /** Database client shared across all services */
    private readonly db;
    /** Permission registry shared across services */
    private readonly permissionRegistry;
    /** Lazy-loaded context service instance */
    private _contextService?;
    /** Lazy-loaded role service instance */
    private _roleService?;
    /** Lazy-loaded user permission service instance */
    private _userPermissionService?;
    /** Lazy-loaded user service instance */
    private _userService?;
    /** Lazy-loaded ABAC policy service instance */
    private _policyService?;
    /**
     * Constructor for ServiceFactory
     * @param config - Configuration object containing the database client
     */
    constructor(config: ServiceFactoryConfig);
    /**
     * Gets the context service instance (lazy-loaded)
     *
     * Creates the context service on first access and reuses the same instance
     * for subsequent calls. The service is configured with the shared database
     * client.
     *
     * @returns IContextService instance
     */
    getContextService(): IContextService;
    /**
     * Gets the role service instance (lazy-loaded)
     *
     * Creates the role service on first access and reuses the same instance
     * for subsequent calls. The service is configured with the shared database
     * client.
     *
     * @returns IRoleService instance
     */
    getRoleService(): IRoleService;
    /**
     * Gets the permission service instance (lazy-loaded)
     *
     * Creates the user permission service on first access and reuses the same
     * instance for subsequent calls. The service is configured with the shared
     * database client.
     *
     * @returns IPermissionService instance
     */
    getPermissionService(): IPermissionService;
    /**
     * Gets the user service instance (lazy-loaded)
     *
     * Creates the user service on first access and reuses the same instance
     * for subsequent calls. The service is configured with the shared database
     * client.
     *
     * @returns IUserService instance
     */
    getUserService(): IUserService;
    /**
     * Gets the ABAC policy service instance (lazy-loaded)
     * @returns IPolicyService instance
     */
    getPolicyService(): IPolicyService;
    /**
     * Gets all service instances at once
     *
     * Convenience method to retrieve all available services in a single call.
     * Useful for dependency injection or when multiple services are needed.
     *
     * @returns Object containing all service instances
     */
    getAllServices(): {
        context: IContextService;
        role: IRoleService;
        permission: IPermissionService;
        user: IUserService;
        policy: IPolicyService;
    };
    /**
     * Gracefully shuts down all services
     *
     * This method ensures that all services are properly cleaned up.
     * Should be called during application shutdown.
     *
     * @returns Promise that resolves when all services are shut down
     */
    shutdown(): Promise<void>;
    /**
     * Resets all service instances (useful for testing)
     *
     * Clears all cached service instances, forcing them to be recreated
     * on next access. This is particularly useful for testing to ensure
     * clean state between tests.
     */
    reset(): void;
}
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
export declare function getServiceFactory(config?: ServiceFactoryConfig): ServiceFactory;
/**
 * Sets the global service factory instance
 *
 * This function allows setting a custom service factory instance,
 * which is useful for testing or when you need to provide a mock
 * factory implementation.
 *
 * @param factory - ServiceFactory instance to set as global
 */
export declare function setServiceFactory(factory: ServiceFactory): void;
/**
 * Resets the global service factory instance
 *
 * This function clears the global service factory instance, forcing
 * it to be reinitialized on next access. This is useful for testing
 * to ensure clean state between tests.
 */
export declare function resetServiceFactory(): void;
