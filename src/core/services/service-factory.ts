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

import type { PrismaClient as PrismaClientType } from '../../../prisma/generated/client';
import { ContextService } from './context-service';
import { RoleService } from './role-service';
import { UserPermissionService } from './user-permission-service';
import { UserService } from './user-service';
import { IServiceFactory, type IUserService, type IRoleService, type IPermissionService, type IContextService } from './interfaces';

/**
 * Configuration interface for ServiceFactory
 * 
 * Defines the required and optional configuration parameters
 * for initializing the service factory.
 */
export interface ServiceFactoryConfig {
  /** Database client instance for all services */
  db: PrismaClientType;
}

/**
 * ServiceFactory Class
 * 
 * Centralized factory for creating and managing all service instances.
 * Implements lazy loading to create services only when needed, reducing
 * memory usage and startup time.
 * 
 * Usage:
 * const factory = new ServiceFactory({ db: prismaClient });
 * const roleService = factory.getRoleService();
 */
export class ServiceFactory implements IServiceFactory {
  /** Database client shared across all services */
  private readonly db: PrismaClientType;
  
  /** Lazy-loaded context service instance */
  private _contextService?: ContextService;
  
  /** Lazy-loaded role service instance */
  private _roleService?: RoleService;
  
  /** Lazy-loaded user permission service instance */
  private _userPermissionService?: UserPermissionService;
  
  /** Lazy-loaded user service instance */
  private _userService?: UserService;

  /**
   * Constructor for ServiceFactory
   * @param config - Configuration object containing the database client
   */
  constructor(config: ServiceFactoryConfig) {
    this.db = config.db;
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
  getContextService(): IContextService {
    if (!this._contextService) {
      this._contextService = new ContextService(this.db);
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
  getRoleService(): IRoleService {
    if (!this._roleService) {
      this._roleService = new RoleService(this.db);
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
  getPermissionService(): IPermissionService {
    if (!this._userPermissionService) {
      this._userPermissionService = new UserPermissionService(this.db);
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
  getUserService(): IUserService {
    if (!this._userService) {
      this._userService = new UserService(this.db);
    }
    return this._userService;
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
  async shutdown(): Promise<void> {
    // Add service shutdown logic here as needed
    await Promise.resolve();
  }

  /**
   * Resets all service instances (useful for testing)
   * 
   * Clears all cached service instances, forcing them to be recreated
   * on next access. This is particularly useful for testing to ensure
   * clean state between tests.
   */
  reset(): void {
    this._contextService = undefined;
    this._roleService = undefined;
    this._userPermissionService = undefined;
    this._userService = undefined;
  }
}

/**
 * Global singleton instance of ServiceFactory
 * 
 * This variable holds the global service factory instance for
 * application-wide access. It's initialized on first use and
 * can be reset for testing purposes.
 */
let globalServiceFactory: ServiceFactory | null = null;

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
export function getServiceFactory(config?: ServiceFactoryConfig): ServiceFactory {
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
export function setServiceFactory(factory: ServiceFactory): void {
  globalServiceFactory = factory;
}

/**
 * Resets the global service factory instance
 * 
 * This function clears the global service factory instance, forcing
 * it to be reinitialized on next access. This is useful for testing
 * to ensure clean state between tests.
 */
export function resetServiceFactory(): void {
  globalServiceFactory = null;
}
