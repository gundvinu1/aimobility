import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { TokenService } from './token.service';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Create a new refresh session.
   * Returns the raw token (only time it's available in plaintext).
   */
  async createSession(
    userId: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ rawToken: string; sessionId: string }> {
    const rawToken = this.tokens.generateRefreshToken();
    const tokenHash = await this.tokens.hashToken(rawToken);

    const expiresAt = this.calculateExpiry(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );

    const session = await this.db.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return { rawToken, sessionId: session.id };
  }

  /**
   * Find and validate a refresh session by token hash lookup.
   * Implements rotation: revoke old session, return userId for new session.
   */
  async rotateSession(
    rawToken: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ userId: string; newRawToken: string } | null> {
    // Find all non-revoked, non-expired sessions
    const sessions = await this.db.refreshSession.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // safety limit
    });

    // Constant-time hash comparison
    let matched: typeof sessions[0] | null = null;
    for (const session of sessions) {
      const isMatch = await this.tokens.verifyTokenHash(session.tokenHash, rawToken);
      if (isMatch) {
        matched = session;
        break;
      }
    }

    if (!matched) {
      this.logger.warn('Refresh token not found — possible reuse attack');
      return null;
    }

    // Revoke the old session
    await this.db.refreshSession.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    // Issue new session
    const newRawToken = this.tokens.generateRefreshToken();
    const newTokenHash = await this.tokens.hashToken(newRawToken);

    const expiresAt = this.calculateExpiry(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );

    await this.db.refreshSession.create({
      data: {
        userId: matched.userId,
        tokenHash: newTokenHash,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return { userId: matched.userId, newRawToken };
  }

  /** Revoke a single session by raw token */
  async revokeSession(rawToken: string): Promise<boolean> {
    const sessions = await this.db.refreshSession.findMany({
      where: { revokedAt: null },
    });

    for (const session of sessions) {
      const isMatch = await this.tokens.verifyTokenHash(session.tokenHash, rawToken);
      if (isMatch) {
        await this.db.refreshSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        return true;
      }
    }
    return false;
  }

  /** Revoke all active sessions for a user */
  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.db.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  private calculateExpiry(expiry: string): Date {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    const ms = (() => {
      switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60_000;
        case 'h': return value * 3_600_000;
        case 'd': return value * 86_400_000;
        default: return 7 * 86_400_000;
      }
    })();
    return new Date(Date.now() + ms);
  }
}
