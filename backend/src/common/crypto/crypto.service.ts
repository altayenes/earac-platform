import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

@Injectable()
export class CryptoService {
  private readonly encryptionKey: Buffer;
  private readonly hashPepper: string;

  constructor(private configService: ConfigService) {
    const rawKey = this.configService.getOrThrow<string>('NATIONAL_ID_ENCRYPTION_KEY');
    this.encryptionKey = Buffer.from(rawKey, 'hex');
    this.hashPepper = this.configService.getOrThrow<string>('NATIONAL_ID_HASH_PEPPER');
  }

  // ─── Argon2id Password Hashing ───
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  // ─── Deterministic HMAC-SHA256 for Unique/Lookup fields (e.g. T.C. Kimlik No) ───
  hashNationalId(nationalId: string): string {
    return crypto
      .createHmac('sha256', this.hashPepper)
      .update(nationalId.trim())
      .digest('hex');
  }

  // ─── AES-256-GCM Symmetric Encryption (Recoverable T.C. Kimlik No) ───
  encryptNationalId(nationalId: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV standard for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(nationalId.trim(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decryptNationalId(encryptedPayload: string): string {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ─── SHA-256 for Refresh Token Hashing ───
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ─── Masking helper (e.g. 12345678901 -> 123*****901) ───
  maskNationalId(nationalId: string): string {
    if (!nationalId || nationalId.length < 6) return '***';
    return `${nationalId.substring(0, 3)}*****${nationalId.substring(nationalId.length - 3)}`;
  }
}
