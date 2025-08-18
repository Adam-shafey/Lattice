import type { PrismaClient } from '../db/db-client';
export interface RegisteredPermission {
    key: string;
    label: string;
    plugin?: string;
}
/**
 * Permission Registry
 *
 * Manages the registration and lookup of permissions in the system.
 * Provides both in-memory and database-backed permission storage with
 * synchronization capabilities.
 */
export declare class PermissionRegistry {
    private readonly registry;
    private initialized;
    private readonly db;
    constructor(db: PrismaClient);
    /**
     * Registers a new permission in the registry
     *
     * @param input.key - Unique permission key (e.g., 'users:read')
     * @param input.label - Human-readable description
     * @param input.plugin - Optional plugin identifier
     */
    register(input: {
        key: string;
        label: string;
        plugin?: string;
    }): void;
    /**
     * Lists all registered permissions
     *
     * @returns Array of registered permissions sorted by key
     */
    list(): RegisteredPermission[];
    /**
     * Checks if a required permission is allowed given a set of granted permissions
     *
     * @param required - The permission key being checked
     * @param granted - Set of permission keys the user has
     * @returns Boolean indicating if the required permission is allowed
     */
    isAllowed(required: string, granted: Set<string>): boolean;
    /**
     * Initializes the registry from the database
     *
     * Loads all permissions from the database into the in-memory registry.
     * This should be called during application startup.
     */
    initFromDatabase(): Promise<void>;
    /**
     * Synchronizes the in-memory registry to the database
     *
     * Creates any new permissions that exist in memory but not in the database.
     * This should be called after registering new permissions.
     */
    syncToDatabase(): Promise<void>;
    /**
     * Gets a specific permission by key
     *
     * @param key - The permission key to look up
     * @returns The registered permission or undefined if not found
     */
    get(key: string): RegisteredPermission | undefined;
    /**
     * Checks if a permission is registered
     *
     * @param key - The permission key to check
     * @returns Boolean indicating if the permission is registered
     */
    has(key: string): boolean;
    /**
     * Gets the total number of registered permissions
     *
     * @returns Number of registered permissions
     */
    size(): number;
    /**
     * Clears all registered permissions (useful for testing)
     */
    clear(): void;
}
