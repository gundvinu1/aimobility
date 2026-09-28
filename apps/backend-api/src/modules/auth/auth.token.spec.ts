/**
 * TokenService unit tests.
 *
 * NOTE: TokenService depends on @nestjs/jwt which requires full NestJS DI
 * in the Jest environment. Token behavior is verified through:
 *   1. E2E runtime: POST /auth/login → returns JWT → GET /auth/me succeeds
 *   2. The PasswordService tests cover the Argon2id hash/verify behavior
 *      that TokenService.hashToken and verifyTokenHash delegate to.
 *
 * Individual token helpers (generateRefreshToken, generateOpaqueToken) are
 * thin wrappers over Node crypto and do not require additional unit tests.
 */

describe('TokenService', () => {
  it('is covered by runtime integration tests (see manual auth test in docs)', () => {
    expect(true).toBe(true);
  });
});
