import type { PrismaClient } from '../db/db-client';
export interface TokenPayload {
    sub: string;
    type: 'access' | 'refresh';
    jti: string;
}
export interface JwtConfig {
    secret: string;
    accessTTL: string;
    refreshTTL: string;
}
export declare function createJwtUtil(config: JwtConfig, db: PrismaClient): {
    signAccess(payload: Pick<TokenPayload, "sub">): string;
    signRefresh(payload: Pick<TokenPayload, "sub">): string;
    verify(token: string): Promise<TokenPayload>;
    verifyWithoutRevocationCheck(token: string): TokenPayload;
};
