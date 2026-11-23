import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService, REFRESH_COOKIE_NAME } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendSmsDto, VerifySmsDto } from './dto/sms.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @ApiOperation({
    summary: 'SMS Doğrulama Kodu Gönderir (REGISTER, LOGIN, PASSWORD_RESET)',
    description:
      'Geliştirme (sandbox) modunda doğrulama kodu terminal loglarına yazdırılır.',
  })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send-sms')
  @HttpCode(HttpStatus.OK)
  async sendSms(@Body() dto: SendSmsDto): Promise<MessageResponseDto> {
    return this.authService.sendSmsCode(dto);
  }

  @ApiOperation({ summary: 'SMS Kodunun doğruluğunu kontrol eder' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-sms')
  @HttpCode(HttpStatus.OK)
  async verifySms(@Body() dto: VerifySmsDto): Promise<MessageResponseDto> {
    return this.authService.verifySmsCode(dto);
  }

  @ApiOperation({
    summary: 'Müşteri Kaydı (Telefon + SMS Kodu + Parola)',
    description:
      '15 dakikalık JWT Erişim Belirteci döner ve 7 günlük HttpOnly yenileme çerezini ayarlar.',
  })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.register(dto, res);
  }

  @ApiOperation({
    summary: 'Kullanıcı Girişi (Telefon + Parola)',
    description:
      '15 dakikalık JWT Erişim Belirteci döner ve 7 günlük HttpOnly yenileme çerezini ayarlar.',
  })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto, res);
  }

  @ApiOperation({
    summary: 'Erişim Belirtecini Yeniler (Refresh Token Rotation)',
    description:
      'HttpOnly çerezi okur, eski çerezi iptal edip yenisini üretir ve taze 15 dk erişim belirteci döner.',
  })
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiResponse({
    status: 200,
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    return this.authService.refreshToken(rawToken, res);
  }

  @ApiOperation({ summary: 'Güvenli Çıkış (Refresh Token iptal edilir ve çerez temizlenir)' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    return this.authService.logout(rawToken, res);
  }

  @ApiOperation({ summary: 'SMS Doğrulaması ile Parola Sıfırlama' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({ summary: 'Mevcut oturum açmış kullanıcının kimliğini doğrular' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser('sub') userId: string): Promise<UserResponseDto> {
    return this.usersService.findById(userId);
  }
}
