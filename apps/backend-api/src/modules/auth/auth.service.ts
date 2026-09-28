import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import type { AuthUser } from './types/auth-user.type';
import type { CurrentUserDto, AuthTokens } from '@ai-mos/types';
import { ROLES, AUTH_AUDIT_EVENTS } from '@ai-mos/constants';
import { UserStatus, Prisma } from '@prisma/client';

export interface AuthResponse {
  user: CurrentUserDto;
  tokens: AuthTokens;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly passwords: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessions: SessionService,
  ) {}

  // ─────────────────────────────────────────────────────
  // REGISTRATION
  // ─────────────────────────────────────────────────────

  async register(
    dto: RegisterDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthResponse> {
    // Check for duplicate email
    const existing = await this.db.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    // Get default CUSTOMER role
    let defaultRole = await this.db.role.findUnique({ where: { name: ROLES.CUSTOMER } });
    if (!defaultRole) {
      // Create if seed hasn't run yet
      defaultRole = await this.db.role.create({
        data: { name: ROLES.CUSTOMER, description: 'Default customer role' },
      });
    }

    // Create user + assign role atomically
    const user = await this.db.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        status: UserStatus.ACTIVE,
        roles: {
          create: [{ roleId: defaultRole.id }],
        },
      },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    // Audit log
    await this.audit({
      action: AUTH_AUDIT_EVENTS.REGISTER,
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      metadata: { email: user.email },
      ...meta,
    });

    return this.buildAuthResponse(user, meta);
  }

  // ─────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthResponse> {
    const user = await this.db.user.findUnique({
      where: { email: dto.email },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    // Constant-time: always verify even if user not found (dummy hash)
    const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$dummydummydummydummy$dummydummydummydummydummydummydummydummydummy';
    const hashToVerify = user ? user.passwordHash : DUMMY_HASH;
    const valid = await this.passwords.verify(hashToVerify, dto.password);

    if (!user || !valid || user.deletedAt) {
      // Audit failed login (only if user exists to avoid email enumeration in logs)
      if (user) {
        await this.audit({
          action: AUTH_AUDIT_EVENTS.LOGIN_FAILED,
          entityType: 'User',
          entityId: user.id,
          userId: user.id,
          metadata: { reason: 'invalid_credentials' },
          ...meta,
        });
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Account is inactive');
    }

    await this.audit({
      action: AUTH_AUDIT_EVENTS.LOGIN_SUCCESS,
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      metadata: { email: user.email },
      ...meta,
    });

    return this.buildAuthResponse(user, meta);
  }

  // ─────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────

  async logout(
    userId: string,
    rawRefreshToken: string,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<{ success: boolean }> {
    await this.sessions.revokeSession(rawRefreshToken);

    await this.audit({
      action: AUTH_AUDIT_EVENTS.LOGOUT,
      entityType: 'User',
      entityId: userId,
      userId,
      metadata: {},
      ...meta,
    });

    return { success: true };
  }

  async logoutAll(
    userId: string,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<{ count: number }> {
    const count = await this.sessions.revokeAllSessions(userId);

    await this.audit({
      action: AUTH_AUDIT_EVENTS.LOGOUT_ALL,
      entityType: 'User',
      entityId: userId,
      userId,
      metadata: { revokedSessions: count },
      ...meta,
    });

    return { count };
  }

  // ─────────────────────────────────────────────────────
  // REFRESH TOKEN ROTATION
  // ─────────────────────────────────────────────────────

  async refresh(
    rawRefreshToken: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<Omit<AuthResponse, 'user'>> {
    const rotated = await this.sessions.rotateSession(rawRefreshToken, meta);
    if (!rotated) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { token: accessToken, expiresIn } = await this.tokenService.generateAccessToken(rotated.userId);

    await this.audit({
      action: AUTH_AUDIT_EVENTS.REFRESH,
      entityType: 'User',
      entityId: rotated.userId,
      userId: rotated.userId,
      metadata: {},
      ...meta,
    });

    return {
      tokens: { accessToken, tokenType: 'Bearer', expiresIn },
      refreshToken: rotated.newRawToken,
    };
  }

  // ─────────────────────────────────────────────────────
  // ME — load current user
  // ─────────────────────────────────────────────────────

  async getMe(userId: string): Promise<CurrentUserDto> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    return this.mapUserToDto(user);
  }

  // ─────────────────────────────────────────────────────
  // TOKEN VALIDATION (used by Passport Strategy)
  // ─────────────────────────────────────────────────────

  async validateTokenUser(userId: string): Promise<AuthUser | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (!user || user.deletedAt || user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      return null;
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name)),
      ),
    ];

    return { userId: user.id, email: user.email, roles, permissions };
  }

  // ─────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<{ success: boolean }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await this.passwords.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newHash = await this.passwords.hash(dto.newPassword);
    await this.db.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    // Revoke all refresh sessions for security
    await this.sessions.revokeAllSessions(userId);

    await this.audit({
      action: AUTH_AUDIT_EVENTS.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: userId,
      userId,
      metadata: {},
      ...meta,
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────
  // FORGOT PASSWORD
  // ─────────────────────────────────────────────────────

  async forgotPassword(
    dto: ForgotPasswordDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<{ message: string; developmentToken?: string }> {
    const user = await this.db.user.findUnique({ where: { email: dto.email } });

    // Never reveal whether email exists
    if (!user || user.deletedAt) {
      return { message: 'If the email exists, a reset link will be sent.' };
    }

    // Expire any existing tokens
    await this.db.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }, // mark as used (expired)
    });

    const rawToken = this.tokenService.generateOpaqueToken();
    const tokenHash = await this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.db.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await this.audit({
      action: AUTH_AUDIT_EVENTS.PASSWORD_RESET_REQUESTED,
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      metadata: { email: user.email },
      ...meta,
    });

    // In production: send email. For dev: return token in response (never log it)
    const isDev = process.env.NODE_ENV !== 'production';
    return {
      message: 'If the email exists, a reset link will be sent.',
      ...(isDev && { developmentToken: rawToken }),
    };
  }

  // ─────────────────────────────────────────────────────
  // RESET PASSWORD
  // ─────────────────────────────────────────────────────

  async resetPassword(
    dto: ResetPasswordDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<{ success: boolean }> {
    // Find all active (unused, non-expired) reset tokens
    const resets = await this.db.passwordReset.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
    });

    let matched: typeof resets[0] | null = null;
    for (const reset of resets) {
      const isMatch = await this.tokenService.verifyTokenHash(reset.tokenHash, dto.token);
      if (isMatch) { matched = reset; break; }
    }

    if (!matched) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const newHash = await this.passwords.hash(dto.newPassword);

    await this.db.$transaction([
      this.db.user.update({ where: { id: matched.userId }, data: { passwordHash: newHash } }),
      this.db.passwordReset.update({ where: { id: matched.id }, data: { usedAt: new Date() } }),
    ]);

    await this.sessions.revokeAllSessions(matched.userId);

    await this.audit({
      action: AUTH_AUDIT_EVENTS.PASSWORD_RESET,
      entityType: 'User',
      entityId: matched.userId,
      userId: matched.userId,
      metadata: {},
      ...meta,
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────
  // EMAIL VERIFICATION
  // ─────────────────────────────────────────────────────

  async sendVerificationEmail(
    userId: string,
  ): Promise<{ message: string; developmentToken?: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) return { message: 'Email is already verified.' };

    const rawToken = this.tokenService.generateOpaqueToken();
    const tokenHash = await this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.db.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    const isDev = process.env.NODE_ENV !== 'production';
    return {
      message: 'Verification email sent.',
      ...(isDev && { developmentToken: rawToken }),
    };
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<{ success: boolean }> {
    const tokens = await this.db.emailVerificationToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
    });

    let matched: typeof tokens[0] | null = null;
    for (const t of tokens) {
      const isMatch = await this.tokenService.verifyTokenHash(t.tokenHash, dto.token);
      if (isMatch) { matched = t; break; }
    }

    if (!matched) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.db.$transaction([
      this.db.user.update({ where: { id: matched.userId }, data: { emailVerified: true, status: UserStatus.ACTIVE } }),
      this.db.emailVerificationToken.update({ where: { id: matched.id }, data: { usedAt: new Date() } }),
    ]);

    await this.audit({
      action: AUTH_AUDIT_EVENTS.EMAIL_VERIFIED,
      entityType: 'User',
      entityId: matched.userId,
      userId: matched.userId,
      metadata: {},
      ...meta,
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────

  private async buildAuthResponse(
    user: Awaited<ReturnType<typeof this.db.user.findUniqueOrThrow>> & {
      roles: Array<{ role: { name: string; permissions: Array<{ permission: { name: string } }> } }>;
    },
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponse> {
    const { token: accessToken, expiresIn } = await this.tokenService.generateAccessToken(user.id);
    const { rawToken: refreshToken } = await this.sessions.createSession(user.id, meta);

    const userDto = this.mapUserToDto(user);

    return {
      user: userDto,
      tokens: { accessToken, tokenType: 'Bearer', expiresIn },
      refreshToken,
    };
  }

  private mapUserToDto(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    emailVerified: boolean;
    createdAt: Date;
    roles: Array<{ role: { name: string; permissions: Array<{ permission: { name: string } }> } }>;
  }): CurrentUserDto {
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name))),
    ];

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status as CurrentUserDto['status'],
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      roles,
      permissions,
    };
  }

  private async audit(params: {
    action: string;
    entityType: string;
    entityId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<void> {
    try {
      await this.db.auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: params.userId,
          metadata: (params.metadata ?? {}) as unknown as Prisma.InputJsonValue,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          requestId: params.requestId,
        },
      });
    } catch (err) {
      // Never let audit failures break the main flow
      this.logger.error('Failed to write audit log', err);
    }
  }
}
