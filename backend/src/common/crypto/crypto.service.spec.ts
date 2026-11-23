import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    const mockConfigService = {
      get: (key: string, defaultVal: string) => defaultVal,
      getOrThrow: (key: string) => {
        if (key === 'NATIONAL_ID_ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (key === 'NATIONAL_ID_HASH_PEPPER') {
          return 'yerel-gelistirme-pepper-degeri';
        }
        return 'test-secret';
      },
    } as unknown as ConfigService;

    service = new CryptoService(mockConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Password Hashing (Argon2id)', () => {
    it('should hash and verify password correctly', async () => {
      const password = 'TestSecretPassword123!';
      const hash = await service.hashPassword(password);
      expect(hash).toContain('$argon2id$');

      const isValid = await service.verifyPassword(hash, password);
      expect(isValid).toBe(true);

      const isInvalid = await service.verifyPassword(hash, 'WrongPassword');
      expect(isInvalid).toBe(false);
    });
  });

  describe('National ID Encryption & Decryption (AES-256-GCM)', () => {
    it('should encrypt and decrypt T.C. Kimlik No correctly', () => {
      const nationalId = '12345678901';
      const encrypted = service.encryptNationalId(nationalId);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:encrypted

      const decrypted = service.decryptNationalId(encrypted);
      expect(decrypted).toBe(nationalId);
    });
  });

  describe('National ID Deterministic Hashing (HMAC-SHA256)', () => {
    it('should produce deterministic hash for identical input', () => {
      const id1 = '12345678901';
      const id2 = '12345678901';
      const id3 = '98765432109';

      const hash1 = service.hashNationalId(id1);
      const hash2 = service.hashNationalId(id2);
      const hash3 = service.hashNationalId(id3);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('Masking Helper', () => {
    it('should mask national id properly for privacy', () => {
      const masked = service.maskNationalId('12345678901');
      expect(masked).toBe('123*****901');
    });
  });
});
