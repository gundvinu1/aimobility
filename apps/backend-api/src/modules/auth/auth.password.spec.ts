import { PasswordService } from './services/password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  describe('hash', () => {
    it('should hash a password and return a different string', async () => {
      const hash = await service.hash('MyStr0ng!Pass');
      expect(hash).not.toBe('MyStr0ng!Pass');
      expect(hash.startsWith('$argon2id')).toBe(true);
    });

    it('should produce different hashes for the same password', async () => {
      const h1 = await service.hash('SamePassword1!');
      const h2 = await service.hash('SamePassword1!');
      expect(h1).not.toBe(h2); // different salts
    });
  });

  describe('verify', () => {
    it('should verify a correct password', async () => {
      const hash = await service.hash('MyStr0ng!Pass');
      const result = await service.verify(hash, 'MyStr0ng!Pass');
      expect(result).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const hash = await service.hash('MyStr0ng!Pass');
      const result = await service.verify(hash, 'WrongPassword!');
      expect(result).toBe(false);
    });

    it('should return false for malformed hash', async () => {
      const result = await service.verify('not-a-valid-hash', 'password');
      expect(result).toBe(false);
    });
  });
});
