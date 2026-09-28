// =============================================================================
// Auth API Client
// =============================================================================

import { ApiClient, type ApiClientConfig } from './client';
import type {
  CurrentUserDto,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@ai-mos/types';
import type { ApiResponse } from '@ai-mos/types';

export interface AuthResponse {
  user: CurrentUserDto;
  tokens: AuthTokens;
  refreshToken: string;
}

export interface RefreshResponse {
  tokens: AuthTokens;
  refreshToken: string;
}

export class AuthApiClient extends ApiClient {
  constructor(config: ApiClientConfig) {
    super(config);
  }

  /** Register a new user */
  register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    return this.post<AuthResponse>('/v1/auth/register', data);
  }

  /** Login with email and password */
  login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return this.post<AuthResponse>('/v1/auth/login', data);
  }

  /** Rotate refresh token */
  refresh(data: RefreshTokenRequest): Promise<ApiResponse<RefreshResponse>> {
    return this.post<RefreshResponse>('/v1/auth/refresh', data);
  }

  /** Logout (revoke current refresh session) */
  logout(refreshToken: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.post<{ success: boolean }>('/v1/auth/logout', { refreshToken });
  }

  /** Logout all devices */
  logoutAll(): Promise<ApiResponse<{ count: number }>> {
    return this.post<{ count: number }>('/v1/auth/logout-all');
  }

  /** Get current user profile */
  me(): Promise<ApiResponse<CurrentUserDto>> {
    return this.get<CurrentUserDto>('/v1/auth/me');
  }

  /** Change password */
  changePassword(data: ChangePasswordRequest): Promise<ApiResponse<{ success: boolean }>> {
    return this.post<{ success: boolean }>('/v1/auth/change-password', data);
  }

  /** Request password reset email */
  forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>('/v1/auth/forgot-password', data);
  }

  /** Reset password using one-time token */
  resetPassword(data: ResetPasswordRequest): Promise<ApiResponse<{ success: boolean }>> {
    return this.post<{ success: boolean }>('/v1/auth/reset-password', data);
  }

  /** Verify email using one-time token */
  verifyEmail(data: VerifyEmailRequest): Promise<ApiResponse<{ success: boolean }>> {
    return this.post<{ success: boolean }>('/v1/auth/verify-email', data);
  }

  /** Set the Authorization header for authenticated requests */
  setAccessToken(token: string | null): void {
    if (token) {
      this.http.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.http.defaults.headers.common['Authorization'];
    }
  }
}

/** Create a configured AuthApiClient instance */
export function createAuthApiClient(baseURL: string): AuthApiClient {
  return new AuthApiClient({ baseURL });
}
