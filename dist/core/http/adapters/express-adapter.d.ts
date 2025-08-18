import { Express } from 'express';
import type { LatticeCore, HttpAdapter } from '../../../index';
export interface ExpressHttpAdapter extends HttpAdapter {
    getUnderlying: () => Express;
}
/**
 * Creates an Express HTTP adapter for the LatticeCore application
 *
 * This adapter wraps Express.js functionality to provide a consistent
 * interface for route registration and server management.
 *
 * @param app - The LatticeCore application instance
 * @returns ExpressHttpAdapter instance
 */
export declare function createExpressAdapter(app: LatticeCore): ExpressHttpAdapter;
