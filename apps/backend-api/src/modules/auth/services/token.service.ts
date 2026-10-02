import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import type { AccessTokenPayload } from '../types/auth-user.type';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Generate a signed JWT access token */
  async generateAccessToken(userId: string): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const payload: AccessTokenPayload = { sub: userId, type: 'access' };
    const token = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: expiresIn as unknown as number,
    });

    // Parse expiry for client
    const expiresInSeconds = this.parseExpiry(expiresIn);
    return { token, expiresIn: expiresInSeconds };
  }

  /** Generate a cryptographically random refresh token */
  generateRefreshToken(): string {
    return randomBytes(64).toString('base64url');
  }

  /** Hash a raw refresh token for storage */
  async hashToken(raw: string): Promise<string> {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Verify a raw token against stored hash */
  async verifyTokenHash(hash: string, raw: string): Promise<boolean> {
    try {
      const computed = createHash('sha256').update(raw).digest('hex');
      return timingSafeEqual(Buffer.from(hash), Buffer.from(computed));
    } catch {
      return false;
    }
  }

  /** Generate a secure one-time token (for password reset / email verify) */
  generateOpaqueToken(): string {
    return randomBytes(48).toString('base64url');
  }

  /** Verify a signed JWT — returns null if invalid */
  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      return this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }
  }

  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900; // 15m fallback
    }
  }
}
