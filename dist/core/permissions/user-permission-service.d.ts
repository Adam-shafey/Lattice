export declare class UserPermissionService {
    private readonly audit;
    grantToUser(params: {
        userId: string;
        permissionKey: string;
        contextId?: string | null;
        contextType?: string | null;
        actorId?: string | null;
        source?: string;
        reason?: string;
    }): Promise<void>;
    revokeFromUser(params: {
        userId: string;
        permissionKey: string;
        contextId?: string | null;
        contextType?: string | null;
        actorId?: string | null;
        source?: string;
        reason?: string;
    }): Promise<void>;
}
