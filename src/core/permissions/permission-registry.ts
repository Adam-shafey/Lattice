import { isAllowedByWildcard } from './wildcard-utils';
import { db } from '../db/db-client';

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
export class PermissionRegistry {
  private readonly registry: Map<string, RegisteredPermission> = new Map();
  private initialized = false;

  /**
   * Registers a new permission in the registry
   * 
   * @param input.key - Unique permission key (e.g., 'users:read')
   * @param input.label - Human-readable description
   * @param input.plugin - Optional plugin identifier
   */
  register(input: { key: string; label: string; plugin?: string }): void {
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
  list(): RegisteredPermission[] {
    return Array.from(this.registry.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Checks if a required permission is allowed given a set of granted permissions
   * 
   * @param required - The permission key being checked
   * @param granted - Set of permission keys the user has
   * @returns Boolean indicating if the required permission is allowed
   */
  isAllowed(required: string, granted: Set<string>): boolean {
    console.log('🎯 [PERMISSION_REGISTRY] Starting isAllowed check');
    console.log('🎯 [PERMISSION_REGISTRY] Required permission:', required);
    console.log('🎯 [PERMISSION_REGISTRY] Granted permissions count:', granted.size);
    console.log('🎯 [PERMISSION_REGISTRY] Granted permissions:', Array.from(granted));
    
    const result = isAllowedByWildcard(required, granted);
    console.log('🎯 [PERMISSION_REGISTRY] isAllowedByWildcard result:', result);
    
    return result;
  }

  /**
   * Initializes the registry from the database
   * 
   * Loads all permissions from the database into the in-memory registry.
   * This should be called during application startup.
   */
  async initFromDatabase(): Promise<void> {
    if (this.initialized) {
      return; // Already initialized
    }
    
    try {
      const rows = await db.permission.findMany();
      for (const row of rows) {
        this.registry.set(row.key, { 
          key: row.key, 
          label: row.label, 
          plugin: row.plugin ?? undefined 
        });
      }
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize permission registry from database: ${error}`);
    }
  }

  /**
   * Synchronizes the in-memory registry to the database
   * 
   * Creates any new permissions that exist in memory but not in the database.
   * This should be called after registering new permissions.
   */
  async syncToDatabase(): Promise<void> {
    try {
      // Get all permission keys currently in the database
      const inDb = new Set(
        (await db.permission.findMany({ select: { key: true } }))
          .map((r: { key: string }) => r.key)
      );
      
      // Create any permissions that exist in memory but not in database
      for (const p of this.registry.values()) {
        if (!inDb.has(p.key)) {
          await db.permission.create({ 
            data: { 
              key: p.key, 
              label: p.label, 
              plugin: p.plugin ?? null 
            } 
          });
        }
      }
    } catch (error) {
      throw new Error(`Failed to sync permission registry to database: ${error}`);
    }
  }

  /**
   * Gets a specific permission by key
   * 
   * @param key - The permission key to look up
   * @returns The registered permission or undefined if not found
   */
  get(key: string): RegisteredPermission | undefined {
    return this.registry.get(key);
  }

  /**
   * Checks if a permission is registered
   * 
   * @param key - The permission key to check
   * @returns Boolean indicating if the permission is registered
   */
  has(key: string): boolean {
    return this.registry.has(key);
  }

  /**
   * Gets the total number of registered permissions
   * 
   * @returns Number of registered permissions
   */
  size(): number {
    return this.registry.size;
  }

  /**
   * Clears all registered permissions (useful for testing)
   */
  clear(): void {
    this.registry.clear();
    this.initialized = false;
  }
}


