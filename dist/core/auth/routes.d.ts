import { CoreSaaSApp } from '../../index';
export declare function requireAuthMiddleware(): (req: any, res: any, next?: (err?: any) => void) => Promise<any>;
export declare function createAuthRoutes(app: CoreSaaSApp): void;
