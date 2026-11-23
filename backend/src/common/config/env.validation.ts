import * as dotenv from 'dotenv';
import * as path from 'path';

export function validateEnvironment(): void {
  // If required vars are not already set in process.env, load from root .env or backend .env
  if (!process.env.DATABASE_URL) {
    dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
    dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
    dotenv.config();
  }

  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'NATIONAL_ID_ENCRYPTION_KEY',
    'NATIONAL_ID_HASH_PEPPER',
  ];

  const missing = requiredVars.filter(
    (v) => !process.env[v] || process.env[v]?.trim() === '',
  );

  if (missing.length > 0) {
    console.error(
      `❌ [FATAL ENV ERROR] Eksik zorunlu ortam değişkenleri: ${missing.join(', ')}`,
    );
    console.error(
      'Uygulama fail-fast ilkesi gereği başlatılamadı. Lütfen .env dosyanızı kontrol ediniz.',
    );
    process.exit(1);
  }

  // NATIONAL_ID_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)
  const encKey = process.env.NATIONAL_ID_ENCRYPTION_KEY!.trim();
  const hexRegex = /^[0-9a-fA-F]{64}$/;
  if (!hexRegex.test(encKey)) {
    console.error(
      '❌ [FATAL ENV ERROR] NATIONAL_ID_ENCRYPTION_KEY 32 byte (64 onaltılık / hex karakter) olmak zorundadır!',
    );
    process.exit(1);
  }
}
