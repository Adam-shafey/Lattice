import { BaseService, ServiceError, type ServiceContext } from './base-service';
import { IContextService } from './interfaces';
import type { Context, User } from '../db/db-client';

export interface ResolveContextInput {
  routeParam?: string | null;
  header?: string | null;
  query?: string | null;
}

export interface ContextObject { 
  id: string;
  type?: string;
  name?: string;
}

export class ContextService extends BaseService implements IContextService {

  constructor(db: any) {
    super(db);
  }
  
  resolveContext(input: ResolveContextInput): ContextObject | null {
    const candidates = [input.routeParam, input.header, input.query].filter(Boolean) as string[];
    if (candidates.length === 0) return null;
    
    const selected = input.routeParam ?? input.header ?? input.query;
    return selected ? { id: selected } : null;
  }

  async createContext(params: {
    id: string;
    type: string;
    name?: string;
    context?: ServiceContext;
  }): Promise<Context> {
    const { id, type, name, context: serviceContext } = params;

    // Validate inputs
    this.validateString(id, 'context id');
    this.validateString(type, 'context type');
    if (name) this.validateString(name, 'context name');

    return this.execute(
      async () => {
        // Check if context already exists
        const existing = await this.db.context.findUnique({ where: { id } });
        if (existing) {
          throw ServiceError.conflict(`Context with id '${id}' already exists`);
        }

        const context = await this.db.context.create({
          data: {
            id,
            type,
            name: name ?? null,
          },
        });

        return context;
      },
      {
        action: 'context.created',
        success: true,
        resourceType: 'context',
        resourceId: id,
        metadata: { type, name },
      },
      serviceContext
    );
  }

  async getContext(id: string, context?: ServiceContext): Promise<Context | null> {
    this.validateString(id, 'context id');

    return this.execute(
      async () => {
        return this.db.context.findUnique({ where: { id } });
      },
      {
        action: 'context.read',
        success: true,
        resourceType: 'context',
        resourceId: id,
      },
      context
    );
  }

  async updateContext(
    id: string, 
    updates: { name?: string; type?: string }, 
    context?: ServiceContext
  ): Promise<Context> {
    this.validateString(id, 'context id');
    
    if (updates.name !== undefined) {
      this.validateString(updates.name, 'context name');
    }
    if (updates.type !== undefined) {
      this.validateString(updates.type, 'context type');
    }

    return this.execute(
      async () => {
        const existing = await this.db.context.findUnique({ where: { id } });
        if (!existing) {
          throw ServiceError.notFound('Context', id);
        }

        const updated = await this.db.context.update({
          where: { id },
          data: {
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.type !== undefined && { type: updates.type }),
          },
        });

        return updated;
      },
      {
        action: 'context.updated',
        success: true,
        resourceType: 'context',
        resourceId: id,
        metadata: updates,
      },
      context
    );
  }

  async deleteContext(id: string, context?: ServiceContext): Promise<void> {
    this.validateString(id, 'context id');

    return this.execute(
      async () => {
        const existing = await this.db.context.findUnique({ where: { id } });
        if (!existing) {
          throw ServiceError.notFound('Context', id);
        }

        // Use transaction to ensure all related data is deleted
        await this.withTransaction(async (tx) => {
          // Delete all related records
          await tx.userContext.deleteMany({ where: { contextId: id } });
          await tx.userRole.deleteMany({ where: { contextId: id } });
          await tx.rolePermission.deleteMany({ where: { contextId: id } });
          await tx.userPermission.deleteMany({ where: { contextId: id } });
          
          // Finally delete the context
          await tx.context.delete({ where: { id } });
        });
      },
      {
        action: 'context.deleted',
        success: true,
        resourceType: 'context',
        resourceId: id,
      },
      context
    );
  }

  async listContexts(params?: {
    type?: string;
    limit?: number;
    offset?: number;
    context?: ServiceContext;
  }): Promise<{ contexts: Context[]; total: number }> {
    const { type, limit = 100, offset = 0, context: serviceContext } = params ?? {};

    if (type) this.validateString(type, 'context type');
    if (limit < 1 || limit > 1000) {
      throw ServiceError.validationError('Limit must be between 1 and 1000');
    }
    if (offset < 0) {
      throw ServiceError.validationError('Offset must be non-negative');
    }

    return this.execute(
      async () => {
        const where = type ? { type } : {};

        const [contexts, total] = await Promise.all([
          this.db.context.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          }),
          this.db.context.count({ where }),
        ]);

        return { contexts, total };
      },
      {
        action: 'context.list',
        success: true,
        metadata: { type, limit, offset },
      },
      serviceContext
    );
  }

  async addUserToContext(params: {
    userId: string;
    contextId: string;
    context?: ServiceContext;
  }): Promise<void> {
    const { userId, contextId, context: serviceContext } = params;

    this.validateString(userId, 'user id');
    this.validateString(contextId, 'context id');

    return this.execute(
      async () => {
        // Verify user and context exist
        const [user, contextRecord] = await Promise.all([
          this.db.user.findUnique({ where: { id: userId } }),
          this.db.context.findUnique({ where: { id: contextId } }),
        ]);

        if (!user) {
          throw ServiceError.notFound('User', userId);
        }
        if (!contextRecord) {
          throw ServiceError.notFound('Context', contextId);
        }

        // Check if user is already in context
        const existing = await this.db.userContext.findUnique({
          where: { userId_contextId: { userId, contextId } },
        });

        if (existing) {
          throw ServiceError.conflict(`User ${userId} is already a member of context ${contextId}`);
        }

        await this.db.userContext.create({
          data: { userId, contextId },
        });
      },
      {
        action: 'context.user.added',
        success: true,
        targetUserId: userId,
        contextId,
      },
      serviceContext
    );
  }

  async removeUserFromContext(params: {
    userId: string;
    contextId: string;
    context?: ServiceContext;
  }): Promise<void> {
    const { userId, contextId, context: serviceContext } = params;

    this.validateString(userId, 'user id');
    this.validateString(contextId, 'context id');

    return this.execute(
      async () => {
        // Verify user and context exist
        const [user, contextRecord] = await Promise.all([
          this.db.user.findUnique({ where: { id: userId } }),
          this.db.context.findUnique({ where: { id: contextId } }),
        ]);

        if (!user) {
          throw ServiceError.notFound('User', userId);
        }
        if (!contextRecord) {
          throw ServiceError.notFound('Context', contextId);
        }

        // Remove user from context
        await this.db.userContext.delete({
          where: { userId_contextId: { userId, contextId } },
        }).catch(() => {
          // User wasn't in context, which is fine
        });
      },
      {
        action: 'context.user.removed',
        success: true,
        targetUserId: userId,
        contextId,
      },
      serviceContext
    );
  }

  async getContextUsers(params: {
    contextId: string;
    context?: ServiceContext;
  }): Promise<User[]> {
    const { contextId, context: serviceContext } = params;

    this.validateString(contextId, 'context id');

    return this.execute(
      async () => {
        // Verify context exists
        const context = await this.db.context.findUnique({ where: { id: contextId } });
        if (!context) {
          throw ServiceError.notFound('Context', contextId);
        }

        const userContexts = await this.db.userContext.findMany({
          where: { contextId },
          include: { user: true },
        });

        return userContexts.map(uc => uc.user);
      },
      {
        action: 'context.users.list',
        success: true,
        contextId,

      },
      serviceContext
    );
  }
}


