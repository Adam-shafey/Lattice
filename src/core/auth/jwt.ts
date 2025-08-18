import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
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

export function createJwtUtil(config: JwtConfig, db: PrismaClient) {
  const algorithm: SignOptions['algorithm'] = 'HS256';

  return {
    signAccess(payload: Pick<TokenPayload, 'sub'>): string {
      const jti = randomUUID();
      const options: SignOptions = {
        expiresIn: config.accessTTL as SignOptions['expiresIn'],
        jwtid: jti,
        algorithm,
      };
      const tokenPayload: Omit<TokenPayload, 'jti'> = { ...payload, type: 'access' };
      return jwt.sign(tokenPayload, config.secret as Secret, options);
    },
    signRefresh(payload: Pick<TokenPayload, 'sub'>): string {
      const jti = randomUUID();
      const options: SignOptions = {
        expiresIn: config.refreshTTL as SignOptions['expiresIn'],
        jwtid: jti,
        algorithm,
      };
      const tokenPayload: Omit<TokenPayload, 'jti'> = { ...payload, type: 'refresh' };
      return jwt.sign(tokenPayload, config.secret as Secret, options);
    },
    async verify(token: string): Promise<TokenPayload> {
      const payload = jwt.verify(token, config.secret as Secret, { algorithms: [algorithm] }) as TokenPayload;
      
      // Check if token is revoked by JTI
      const jti = payload?.jti as string | undefined;
      if (jti) {
        const revoked = await db.revokedToken.findUnique({ where: { jti } }).catch(() => null);
        if (revoked) {
          throw new Error('Token revoked');
        }
      }
      
      return payload;
    },
    verifyWithoutRevocationCheck(token: string): TokenPayload {
      return jwt.verify(token, config.secret as Secret, { algorithms: [algorithm] }) as TokenPayload;
    },
  };
}


