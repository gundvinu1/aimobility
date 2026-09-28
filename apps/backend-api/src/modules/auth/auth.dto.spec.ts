import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

async function validateDto<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const instance = plainToInstance(cls, plain);
  return validate(instance);
}

describe('Auth DTOs', () => {
  describe('RegisterDto', () => {
    it('should pass with valid data', async () => {
      const errors = await validateDto(RegisterDto, {
        email: 'john@example.com',
        password: 'MyStr0ng!Pass',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid email', async () => {
      const errors = await validateDto(RegisterDto, {
        email: 'not-an-email',
        password: 'MyStr0ng!Pass',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('should fail with short password', async () => {
      const errors = await validateDto(RegisterDto, {
        email: 'john@example.com',
        password: 'short',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should normalize email to lowercase', async () => {
      const instance = plainToInstance(RegisterDto, {
        email: 'JOHN@EXAMPLE.COM',
        password: 'MyStr0ng!Pass',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(instance.email).toBe('john@example.com');
    });
  });

  describe('LoginDto', () => {
    it('should pass with valid data', async () => {
      const errors = await validateDto(LoginDto, {
        email: 'john@example.com',
        password: 'anypassword',
      });
      expect(errors.length).toBe(0);
    });

    it('should fail with missing email', async () => {
      const errors = await validateDto(LoginDto, { password: 'anypassword' });
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });
  });

  describe('RefreshTokenDto', () => {
    it('should fail with empty token', async () => {
      const errors = await validateDto(RefreshTokenDto, { refreshToken: '' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ChangePasswordDto', () => {
    it('should pass with valid data', async () => {
      const errors = await validateDto(ChangePasswordDto, {
        currentPassword: 'OldPass1!',
        newPassword: 'NewStr0ng!Pass',
      });
      expect(errors.length).toBe(0);
    });

    it('should fail with short new password', async () => {
      const errors = await validateDto(ChangePasswordDto, {
        currentPassword: 'OldPass1!',
        newPassword: 'short',
      });
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
    });
  });
});
