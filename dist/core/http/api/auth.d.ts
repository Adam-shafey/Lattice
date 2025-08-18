import { LatticeCore } from '../../../index';
export declare function requireAuthMiddleware(app: LatticeCore): (req: any, res: any, next?: (err?: any) => void) => Promise<any>;
export declare function createAuthRoutes(app: LatticeCore, prefix?: string): void;
