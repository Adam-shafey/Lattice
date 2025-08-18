import { BaseService, type ServiceContext } from './base-service';
import { IRoleService } from './interfaces';
import type { PrismaClient, Role, UserRole, RolePermission } from '../db/db-client';
export declare class RoleService extends BaseService implements IRoleService {
    constructor(db: PrismaClient);
    createRole(params: {
        name: string;
        contextType: string;
        key?: string;
        context?: ServiceContext;
    }): Promise<Role>;
    getRoleByName(name: string, context?: ServiceContext): Promise<Role | null>;
    getRoleByKey(key: string, context?: ServiceContext): Promise<Role | null>;
    deleteRole(nameOrKey: string, context?: ServiceContext): Promise<void>;
    listRoles(params?: {
        contextType?: string;
        context?: ServiceContext;
    }): Promise<Role[]>;
    assignRoleToUser(params: {
        roleName?: string;
        roleKey?: string;
        userId: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<UserRole>;
    removeRoleFromUser(params: {
        roleName?: string;
        roleKey?: string;
        userId: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<void>;
    addPermissionToRole(params: {
        roleName?: string;
        roleKey?: string;
        permissionKey: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<RolePermission>;
    removePermissionFromRole(params: {
        roleName?: string;
        roleKey?: string;
        permissionKey: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<void>;
    listUserRoles(params: {
        userId: string;
        contextId?: string | null;
        context?: ServiceContext;
    }): Promise<Array<{
        name: string;
        contextId: string | null;
    }>>;
    getRolePermissions(params: {
        roleId: string;
        contextId?: string | null;
        contextType?: string | null;
        context?: ServiceContext;
    }): Promise<Array<{
        key: string;
        label: string;
        contextId: string | null;
    }>>;
    bulkAssignRolesToUser(params: {
        userId: string;
        roles: Array<{
            roleName?: string;
            roleKey?: string;
            contextId?: string | null;
            contextType?: string | null;
        }>;
        context?: ServiceContext;
    }): Promise<UserRole[]>;
}
