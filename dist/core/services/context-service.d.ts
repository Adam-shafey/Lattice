import { BaseService, type ServiceContext } from './base-service';
import { IContextService } from './interfaces';
import type { PrismaClient, Context, User } from '../db/db-client';
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
export declare class ContextService extends BaseService implements IContextService {
    constructor(db: PrismaClient);
    resolveContext(input: ResolveContextInput): ContextObject | null;
    createContext(params: {
        id: string;
        type: string;
        name?: string;
        context?: ServiceContext;
    }): Promise<Context>;
    getContext(id: string, context?: ServiceContext): Promise<Context | null>;
    updateContext(id: string, updates: {
        name?: string;
        type?: string;
    }, context?: ServiceContext): Promise<Context>;
    deleteContext(id: string, context?: ServiceContext): Promise<void>;
    listContexts(params?: {
        type?: string;
        limit?: number;
        offset?: number;
        context?: ServiceContext;
    }): Promise<{
        contexts: Context[];
        total: number;
    }>;
    addUserToContext(params: {
        userId: string;
        contextId: string;
        context?: ServiceContext;
    }): Promise<void>;
    removeUserFromContext(params: {
        userId: string;
        contextId: string;
        context?: ServiceContext;
    }): Promise<void>;
    getContextUsers(params: {
        contextId: string;
        context?: ServiceContext;
    }): Promise<User[]>;
}
