/**
 * Telefon & İletişim Doğrulama ve Maskeleme Araçları
 * Türkiye cep telefonları: 5XX XXX XX XX (E.164: +905XXXXXXXXX)
 */

export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');

  // Eğer kullanıcı 90 ile başlarsa kırp
  if (digits.startsWith('90')) {
    digits = digits.slice(2);
  }

  // Maksimum 10 hane (5XX XXX XX XX)
  const cleaned = digits.slice(0, 10);

  if (cleaned.length === 0) return '';
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
}

export function toE164Phone(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  if (digits.startsWith('90')) {
    return `+${digits}`;
  }
  return `+90${digits}`;
}

export function isValidTurkishPhone(formatted: string): boolean {
  const digits = formatted.replace(/\D/g, '');
  const cleaned = digits.startsWith('90') ? digits.slice(2) : digits;
  return cleaned.length === 10 && cleaned.startsWith('5');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
