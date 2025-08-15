import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db } from '../db/db-client';

export interface JwtConfig {
  secret: string;
  accessTTL: string;
  refreshTTL: string;
}

export function createJwtUtil(config: JwtConfig) {
  return {
    signAccess(payload: object): string {
      const options: SignOptions = {
        expiresIn: config.accessTTL as unknown as SignOptions['expiresIn'],
        jwtid: randomUUID(),
      };
      return jwt.sign({ ...payload, type: 'access' } as any, config.secret as Secret, options);
    },
    signRefresh(payload: object): string {
      const options: SignOptions = {
        expiresIn: config.refreshTTL as unknown as SignOptions['expiresIn'],
        jwtid: randomUUID(),
      };
      return jwt.sign({ ...payload, type: 'refresh' } as any, config.secret as Secret, options);
    },
    async verify(token: string): Promise<unknown> {
      const payload = jwt.verify(token, config.secret as Secret) as any;
      
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
  };
}


