"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionRegistry = void 0;
const wildcard_utils_1 = require("./wildcard-utils");
const logger_1 = require("../logger");
/**
 * Permission Registry
 *
 * Manages the registration and lookup of permissions in the system.
 * Provides both in-memory and database-backed permission storage with
 * synchronization capabilities.
 */
class PermissionRegistry {
    constructor(db) {
        this.registry = new Map();
        this.initialized = false;
        this.db = db;
    }
    /**
     * Registers a new permission in the registry
     *
     * @param input.key - Unique permission key (e.g., 'users:read')
     * @param input.label - Human-readable description
     * @param input.plugin - Optional plugin identifier
     */
    register(input) {
        if (!input.key) {
            throw new Error('Permission key is required');
        }
        const existing = this.registry.get(input.key);
        if (existing) {
            return; // idempotent - don't overwrite existing permissions
        }
        this.registry.set(input.key, {
            key: input.key,
            label: input.label ?? input.key,
            plugin: input.plugin
        });
    }
    /**
     * Lists all registered permissions
     *
     * @returns Array of registered permissions sorted by key
     */
    list() {
        return Array.from(this.registry.values()).sort((a, b) => a.key.localeCompare(b.key));
    }
    /**
     * Checks if a required permission is allowed given a set of granted permissions
     *
     * @param required - The permission key being checked
     * @param granted - Set of permission keys the user has
     * @returns Boolean indicating if the required permission is allowed
     */
    isAllowed(required, granted) {
        logger_1.logger.log('🎯 [PERMISSION_REGISTRY] Starting isAllowed check');
        logger_1.logger.log('🎯 [PERMISSION_REGISTRY] Required permission:', required);
        logger_1.logger.log('🎯 [PERMISSION_REGISTRY] Granted permissions count:', granted.size);
        logger_1.logger.log('🎯 [PERMISSION_REGISTRY] Granted permissions:', Array.from(granted));
        const result = (0, wildcard_utils_1.isAllowedByWildcard)(required, granted);
        logger_1.logger.log('🎯 [PERMISSION_REGISTRY] isAllowedByWildcard result:', result);
        return result;
    }
    /**
     * Initializes the registry from the database
     *
     * Loads all permissions from the database into the in-memory registry.
     * This should be called during application startup.
     */
    async initFromDatabase() {
        if (this.initialized) {
            return; // Already initialized
        }
        try {
            const rows = await this.db.permission.findMany();
            for (const row of rows) {
                this.registry.set(row.key, {
                    key: row.key,
                    label: row.label,
                    plugin: row.plugin ?? undefined
                });
            }
            this.initialized = true;
        }
        catch (error) {
            throw new Error(`Failed to initialize permission registry from database: ${error}`);
        }
    }
    /**
     * Synchronizes the in-memory registry to the database
     *
     * Creates any new permissions that exist in memory but not in the database.
     * This should be called after registering new permissions.
     */
    async syncToDatabase() {
        try {
            // Get all permission keys currently in the database
            const inDb = new Set((await this.db.permission.findMany({ select: { key: true } }))
                .map((r) => r.key));
            // Create any permissions that exist in memory but not in database
            for (const p of this.registry.values()) {
                if (!inDb.has(p.key)) {
                    await this.db.permission.create({
                        data: {
                            key: p.key,
                            label: p.label,
                            plugin: p.plugin ?? null
                        }
                    });
                }
            }
        }
        catch (error) {
            throw new Error(`Failed to sync permission registry to database: ${error}`);
        }
    }
    /**
     * Gets a specific permission by key
     *
     * @param key - The permission key to look up
     * @returns The registered permission or undefined if not found
     */
    get(key) {
        return this.registry.get(key);
    }
    /**
     * Checks if a permission is registered
     *
     * @param key - The permission key to check
     * @returns Boolean indicating if the permission is registered
     */
    has(key) {
        return this.registry.has(key);
    }
    /**
     * Gets the total number of registered permissions
     *
     * @returns Number of registered permissions
     */
    size() {
        return this.registry.size;
    }
    /**
     * Clears all registered permissions (useful for testing)
     */
    clear() {
        this.registry.clear();
        this.initialized = false;
    }
}
exports.PermissionRegistry = PermissionRegistry;
