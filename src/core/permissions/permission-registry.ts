import { isAllowedByWildcard } from './wildcard-utils';
import { db } from '../db/db-client';

export interface RegisteredPermission {
  key: string;
  label: string;
  plugin?: string;
}

export class PermissionRegistry {
  private readonly registry: Map<string, RegisteredPermission> = new Map();
  private initialized = false;

  register(input: { key: string; label: string; plugin?: string }): void {
    if (!input.key) throw new Error('Permission key is required');
    const existing = this.registry.get(input.key);
    if (existing) return; // idempotent
    this.registry.set(input.key, { key: input.key, label: input.label ?? input.key, plugin: input.plugin });
  }

  list(): RegisteredPermission[] {
    return Array.from(this.registry.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  isAllowed(required: string, granted: Set<string>): boolean {
    return isAllowedByWildcard(required, granted);
  }

  async initFromDatabase(): Promise<void> {
    if (this.initialized) return;
    const rows = await db.permission.findMany();
    for (const row of rows) {
      this.registry.set(row.key, { key: row.key, label: row.label, plugin: row.plugin ?? undefined });
    }
    this.initialized = true;
  }

  async syncToDatabase(): Promise<void> {
    const inDb = new Set((await db.permission.findMany({ select: { key: true } })).map((r) => r.key));
    for (const p of this.registry.values()) {
      if (!inDb.has(p.key)) {
        await db.permission.create({ data: { key: p.key, label: p.label, plugin: p.plugin ?? null } });
      }
    }
  }
}


