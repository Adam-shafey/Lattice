import type { StoragePort, ContextSelector } from "../ports/storage";
export interface DecisionInput {
    userId: string;
    action: string;
    context?: ContextSelector;
}
export interface Decision {
    allowed: boolean;
    reason: string;
}
export interface AuthorizationService {
    can(input: DecisionInput): Promise<boolean>;
    decide(input: DecisionInput): Promise<Decision>;
}
export interface LatticeConfig {
    storage: StoragePort;
}
export declare function createAuthorizationService(cfg: LatticeConfig): AuthorizationService;
