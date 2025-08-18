import type { IPolicyService } from '../services/interfaces';
export interface AttributeProvider {
    getUserAttributes(userId: string): Promise<Record<string, any>>;
    getResourceAttributes(resource: {
        type: string;
        id: string | null;
    } | null): Promise<Record<string, any>>;
    getEnvironmentAttributes(): Promise<Record<string, any>>;
}
export declare class DefaultAttributeProvider implements AttributeProvider {
    getUserAttributes(userId: string): Promise<Record<string, any>>;
    getResourceAttributes(resource: {
        type: string;
        id: string | null;
    } | null): Promise<Record<string, any>>;
    getEnvironmentAttributes(): Promise<Record<string, any>>;
}
export declare function invalidatePolicyCache(): void;
export declare function evaluateAbac(service: IPolicyService, attributeProvider: AttributeProvider, params: {
    action: string;
    resource: string;
    resourceId: string | null;
    userId: string;
}): Promise<boolean>;
