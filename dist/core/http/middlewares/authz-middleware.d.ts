import { CoreSaaSApp } from '../../../index';
type AuthorizeScope = 'exact' | 'global' | 'type-wide';
export interface AuthorizeOptions {
    contextRequired?: boolean;
    scope?: AuthorizeScope;
    contextType?: string;
}
export declare function createAuthorize(app: CoreSaaSApp, requiredPermission: string, options?: AuthorizeOptions): (req: any, res: any, next?: (err?: any) => void) => Promise<any>;
export {};
