export declare class RoleService {
    private audit;
    createRole(name: string, options?: {
        actorId?: string | null;
        source?: string;
        reason?: string;
        key?: string;
    }): Promise<any>;
    deleteRole(nameOrKey: string, options?: {
        actorId?: string | null;
        source?: string;
        reason?: string;
    }): Promise<void>;
    listRoles(): Promise<any>;
    assignRoleToUser(params: {
        roleName?: string;
        roleKey?: string;
        userId: string;
        contextId?: string | null;
        contextType?: string | null;
        actorId?: string | null;
        source?: string;
        reason?: string;
    }): Promise<any>;
    removeRoleFromUser(params: {
        roleName?: string;
        roleKey?: string;
        userId: string;
        contextId?: string | null;
        contextType?: string | null;
        actorId?: string | null;
        source?: string;
        reason?: string;
    }): Promise<void>;
    addPermissionToRole(params: {
        roleName?: string;
        roleKey?: string;
        permissionKey: string;
        contextId?: string | null;
        contextType?: string | null;
        actorId?: string | null;
        source?: string;
        reason?: string;
    }): Promise<any>;
    removePermissionFromRole(params: {
        roleName?: string;
        roleKey?: string;
        permissionKey: string;
        contextId?: string | null;
        contextType?: string | null;
        actorId?: string | null;
        source?: string;
        reason?: string;
    }): Promise<void>;
    listUserRoles(params: {
        userId: string;
        contextId?: string | null;
    }): Promise<any>;
}
