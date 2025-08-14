import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';

export interface JwtConfig {
  secret: string;
  accessTTL: string;
  refreshTTL: string;
}

export function createJwtUtil(config: JwtConfig) {
  return {
    signAccess(payload: object): string {
      const options: SignOptions = { expiresIn: config.accessTTL as unknown as SignOptions['expiresIn'] };
      return jwt.sign(payload as any, config.secret as Secret, options);
    },
    signRefresh(payload: object): string {
      const options: SignOptions = { expiresIn: config.refreshTTL as unknown as SignOptions['expiresIn'] };
      return jwt.sign(payload as any, config.secret as Secret, options);
    },
    verify(token: string): unknown {
      return jwt.verify(token, config.secret as Secret);
    },
  };
}


