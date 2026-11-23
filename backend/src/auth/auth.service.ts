import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { AuditAction, UserRole } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendSmsDto, VerifySmsDto } from './dto/sms.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

export const REFRESH_COOKIE_NAME = 'jid';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshExpiresDays = 7;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private cryptoService: CryptoService,
    private notificationService: NotificationService,
    private auditService: AuditService,
    private usersService: UsersService,
  ) {
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
  }

  // ─── Phone Normalization (+905XXXXXXXXX) ───
  public normalizePhone(phone: string): string {
    let clean = phone.trim().replace(/[\s\-\(\)]/g, '');
    if (clean.startsWith('05')) {
      clean = '+90' + clean.substring(1);
    } else if (clean.startsWith('5')) {
      clean = '+90' + clean;
    } else if (!clean.startsWith('+90') && clean.startsWith('905')) {
      clean = '+' + clean;
    }
    return clean;
  }

  // ─── 1. Send SMS Verification Code ───
  async sendSmsCode(dto: SendSmsDto) {
    const phone = this.normalizePhone(dto.phone);

    // 60-second SMS cooldown rule (429 Too Many Requests)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentSms = await this.prisma.smsVerificationCode.findFirst({
      where: {
        phone,
        createdAt: { gte: oneMinuteAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentSms) {
      throw new HttpException(
        'Lütfen yeni bir SMS kodu istemeden önce 60 saniye bekleyiniz.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Optional business checks
    if (dto.purpose === 'REGISTER') {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) {
        throw new ConflictException('Bu telefon numarası ile kayıtlı bir hesap zaten mevcuttur');
      }
    } else if (dto.purpose === 'PASSWORD_RESET' || dto.purpose === 'LOGIN') {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (!existing) {
        throw new NotFoundException('Bu telefon numarasına ait bir kullanıcı bulunamadı');
      }
    }

    // Generate 6-digit code (use 123456 in sandbox mode for deterministic simulation & testing)
    const isSandbox =
      this.configService.get<string>('SMS_PROVIDER_MODE') === 'sandbox' ||
      this.configService.get<string>('NODE_ENV') !== 'production';
    const code = isSandbox ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Save or update active verification code
    await this.prisma.smsVerificationCode.create({
      data: {
        phone,
        purpose: dto.purpose,
        code,
        expiresAt,
        attempts: 0,
        maxAttempts: 3,
      },
    });

    const purposeText =
      dto.purpose === 'REGISTER'
        ? 'kayıt'
        : dto.purpose === 'PASSWORD_RESET'
          ? 'şifre sıfırlama'
          : 'giriş';

    const message = `EAraç Kiralama ${purposeText} doğrulama kodunuz: ${code}. 5 dakika geçerlidir.`;
    await this.notificationService.sendSms(phone, message);

    return {
      success: true,
      message: 'SMS doğrulama kodu başarıyla gönderildi (Geliştirme modunda konsola yazdırılır)',
    };
  }

  // ─── 2. Verify SMS Code ───
  async verifySmsCode(dto: VerifySmsDto) {
    const phone = this.normalizePhone(dto.phone);
    await this.validateAndConsumeSmsCode(phone, dto.purpose, dto.code);

    return {
      success: true,
      message: 'Telefon numarası başarıyla doğrulandı',
    };
  }

  // ─── 3. Register (Customer) ───
  async register(dto: RegisterDto, res: Response): Promise<AuthResponseDto> {
    const phone = this.normalizePhone(dto.phone);
    const email = dto.email.trim().toLowerCase();

    // 1. Check uniqueness
    const existingPhone = await this.prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      throw new ConflictException('Bu telefon numarası zaten kullanımda');
    }

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new ConflictException('Bu e-posta adresi zaten kullanımda');
    }

    // 2. Verify SMS Code
    await this.validateAndConsumeSmsCode(phone, 'REGISTER', dto.smsCode);

    // 3. Hash password with argon2id
    const passwordHash = await this.cryptoService.hashPassword(dto.password);

    // 4. Create User
    const user = await this.prisma.user.create({
      data: {
        phone,
        email,
        passwordHash,
        role: UserRole.CUSTOMER,
      },
      include: {
        customerProfile: true,
        staffPermission: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_CREATED,
      performedByUserId: user.id,
      details: { role: user.role, phone: user.phone },
    });

    // 5. Generate Tokens & Set Cookie
    const accessToken = await this.generateAccessToken(user);
    await this.issueAndSetRefreshToken(user.id, res);

    return {
      accessToken,
      user: this.usersService.mapToUserResponse(user),
    };
  }

  // ─── 4. Login (Phone + Password) ───
  async login(dto: LoginDto, res: Response): Promise<AuthResponseDto> {
    const phone = this.normalizePhone(dto.phone);

    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        customerProfile: true,
        staffPermission: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Geçersiz telefon numarası veya parola');
    }

    const isMatch = await this.cryptoService.verifyPassword(
      user.passwordHash,
      dto.password,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Geçersiz telefon numarası veya parola');
    }

    // Generate tokens
    const accessToken = await this.generateAccessToken(user);
    await this.issueAndSetRefreshToken(user.id, res);

    return {
      accessToken,
      user: this.usersService.mapToUserResponse(user),
    };
  }

  // ─── 5. Refresh Token Rotation (7 days HttpOnly Cookie) ───
  async refreshToken(refreshTokenRaw: string, res: Response): Promise<{ accessToken: string }> {
    if (!refreshTokenRaw) {
      throw new UnauthorizedException('Yenileme belirteci bulunamadı');
    }

    const tokenHash = this.cryptoService.hashToken(refreshTokenRaw);

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Geçersiz yenileme belirteci');
    }

    if (tokenRecord.expiresAt < new Date() || !tokenRecord.user.isActive) {
      await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Yenileme belirtecinin süresi dolmuş');
    }

    // ROTATION: Delete used token, issue new one
    await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
    await this.issueAndSetRefreshToken(tokenRecord.userId, res);

    // Issue new 15m access token
    const accessToken = await this.generateAccessToken(tokenRecord.user);

    return { accessToken };
  }

  // ─── 6. Logout ───
  async logout(refreshTokenRaw: string | undefined, res: Response) {
    if (refreshTokenRaw) {
      const tokenHash = this.cryptoService.hashToken(refreshTokenRaw);
      await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }
    this.clearRefreshCookie(res);
    return { success: true, message: 'Başarıyla çıkış yapıldı' };
  }

  // ─── 7. Reset Password ───
  async resetPassword(dto: ResetPasswordDto) {
    const phone = this.normalizePhone(dto.phone);

    // 1. Verify SMS code
    await this.validateAndConsumeSmsCode(phone, 'PASSWORD_RESET', dto.smsCode);

    // 2. Find user
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    // 3. Hash new password with argon2id
    const passwordHash = await this.cryptoService.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate all active sessions for this user on password change
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      performedByUserId: user.id,
      details: { action: 'PASSWORD_RESET_SUCCESSFUL' },
    });

    return {
      success: true,
      message: 'Parolanız başarıyla güncellendi. Yeni parolanızla giriş yapabilirsiniz.',
    };
  }

  // ─── Internal Verification & Token Helpers ───
  private async validateAndConsumeSmsCode(
    phone: string,
    purpose: string,
    code: string,
  ) {
    const record = await this.prisma.smsVerificationCode.findFirst({
      where: {
        phone,
        purpose,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Aktif bir doğrulama kodu bulunamadı. Lütfen yeni kod talep edin.');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Doğrulama kodunun süresi dolmuş. Lütfen yeni kod talep edin.');
    }

    if (record.attempts >= record.maxAttempts) {
      throw new BadRequestException(
        'Hatalı deneme sınırına ulaşıldı. Güvenliğiniz için lütfen yeni kod isteyiniz.',
      );
    }

    const isSandbox =
      this.configService.get<string>('SMS_PROVIDER_MODE') === 'sandbox' ||
      this.configService.get<string>('NODE_ENV') !== 'production';
    const isSandboxCode = isSandbox && code.trim() === '123456';

    if (!isSandboxCode && record.code !== code.trim()) {
      await this.prisma.smsVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = record.maxAttempts - (record.attempts + 1);
      throw new BadRequestException(
        `Hatalı doğrulama kodu. Kalan deneme hakkı: ${Math.max(0, remaining)}`,
      );
    }

    // Mark as used
    await this.prisma.smsVerificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  }

  private async generateAccessToken(user: {
    id: string;
    phone: string;
    email: string;
    role: UserRole;
  }): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresIn as any,
    });
  }

  private async issueAndSetRefreshToken(userId: string, res: Response): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.cryptoService.hashToken(rawToken);

    const expiresAt = new Date(
      Date.now() + this.refreshExpiresDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie(REFRESH_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: this.refreshExpiresDays * 24 * 60 * 60 * 1000,
    });

    return rawToken;
  }

  private clearRefreshCookie(res: Response) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
    });
  }
}
