import { describe, it, expect, vi } from 'vitest';
import { ServiceFactory } from '../core/services/service-factory';
import { Lattice } from '../index';
import type { PrismaClient } from '../core/db/db-client';

// Test that ServiceFactory.shutdown disconnects the database client

describe('ServiceFactory.shutdown', () => {
  it('disconnects the database client', async () => {
    const db = { $disconnect: vi.fn().mockResolvedValue(undefined) } as unknown as PrismaClient;
    const factory = new ServiceFactory({ db, permissionRegistry: {} as any });
    await factory.shutdown();
    expect(db.$disconnect).toHaveBeenCalled();
  });
});

// Test that LatticeCore.shutdown awaits service factory shutdown

describe('LatticeCore.shutdown', () => {
  it('awaits the service factory shutdown and disconnects the db', async () => {
    const app = Lattice({
      db: { provider: 'sqlite' },
      adapter: 'fastify',
      jwt: { accessTTL: '15m', refreshTTL: '7d', secret: 'test' },
    });

    let resolveDisconnect!: () => void;
    const disconnectMock = vi.fn(() => new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    }));

    // Override the Prisma client's disconnect method
    (app.db as any).$disconnect = disconnectMock;

    let shutdownComplete = false;
    const shutdownPromise = app.shutdown().then(() => {
      shutdownComplete = true;
    });

    await Promise.resolve();
    expect(disconnectMock).toHaveBeenCalled();
    expect(shutdownComplete).toBe(false);

    resolveDisconnect();
    await shutdownPromise;

    expect(shutdownComplete).toBe(true);
  });
});
