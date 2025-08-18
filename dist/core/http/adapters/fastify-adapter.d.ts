import { FastifyInstance } from 'fastify';
import type { LatticeCore, HttpAdapter } from '../../../index';
export interface FastifyHttpAdapter extends HttpAdapter {
    getUnderlying: () => FastifyInstance;
}
/**
 * Creates a Fastify HTTP adapter for the LatticeCore application
 */
export declare function createFastifyAdapter(app: LatticeCore): FastifyHttpAdapter;
