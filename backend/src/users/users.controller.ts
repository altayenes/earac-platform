import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import {
  CreateCustomerProfileDto,
  UpdateCustomerProfileDto,
  CustomerProfileResponseDto,
} from './dto/customer-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import {
  CreateStaffDto,
  UpdateStaffPermissionsDto,
  CloseAccountDto,
} from './dto/staff.dto';
import {
  ChangePhoneDto,
  VerifyEmailDto,
  CreateProfileCorrectionRequestDto,
  ReviewProfileCorrectionDto,
  ProfileCorrectionQueryDto,
} from './dto/profile-correction.dto';
import { MessageResponseDto } from '../auth/dto/auth-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: 'Mevcut giriş yapmış kullanıcının profil bilgilerini getirir' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @Get('me')
  async getMe(@CurrentUser('sub') userId: string): Promise<UserResponseDto> {
    return this.usersService.findById(userId);
  }

  @ApiOperation({
    summary: 'Müşteri profili oluşturur (T.C. Kimlik No AES-256-GCM ile şifrelenir, HMAC ile hashlenir)',
    description:
      'Önemli Kural: Profil bir kez oluşturulduktan sonra resmi kimlik alanları (Ad, Soyad, T.C. Kimlik No, Doğum Tarihi, Ehliyet Tarihi) değiştirilemez.',
  })
  @ApiResponse({ status: 201, type: CustomerProfileResponseDto })
  @Put('me/profile')
  async createProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateCustomerProfileDto,
  ): Promise<CustomerProfileResponseDto> {
    return this.usersService.createOrUpdateCustomerProfile(userId, dto);
  }

  @ApiOperation({
    summary: 'Müşteri profilini kısmi günceller (Yalnızca iletişim/e-posta güncellenebilir; resmi kimlik alanları değiştirilemez)',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @Patch('me/profile')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateCustomerProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateCustomerProfile(userId, dto);
  }

  @ApiOperation({
    summary: 'Müşteri Hesabını Kapatır (KVKK Uyumlu Anonimleştirme ve Oturum İptali)',
    description:
      'Kullanıcının aktif rezervasyonu yoksa hesabı kapatılır, giriş bilgileri ve kimlik verileri anonimleştirilir, tüm oturumları iptal edilir.',
  })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @Post('me/close-account')
  @HttpCode(HttpStatus.OK)
  async closeAccount(
    @CurrentUser('sub') userId: string,
    @Body() dto: CloseAccountDto,
  ): Promise<MessageResponseDto> {
    return this.usersService.closeCustomerAccount(userId, dto);
  }

  @ApiOperation({
    summary: 'Telefon Numarası Günceller (SMS Doğrulama Kodlu)',
    description: 'Yeni telefona gönderilen 6 haneli SMS kodunu doğrular ve telefon numarasını günceller.',
  })
  @Post('me/change-phone')
  @HttpCode(HttpStatus.OK)
  async changePhone(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePhoneDto,
  ) {
    return this.usersService.changePhone(userId, dto);
  }

  @ApiOperation({
    summary: 'E-posta Adresini Doğrular (Sandbox E-posta Doğrulama)',
  })
  @Post('me/verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @CurrentUser('sub') userId: string,
    @Body() dto: VerifyEmailDto,
  ) {
    return this.usersService.verifyEmail(userId, dto);
  }

  @ApiOperation({
    summary: 'Resmi Kimlik ve Profil Düzeltme Talebi Oluşturur (Müşteri)',
    description:
      'Güvenlik gereği kilitli olan resmi kimlik alanları (Ad, Soyad, T.C. Kimlik No, Doğum/Ehliyet Tarihi) için yönetici onayına gerekçeli düzeltme talebi iletir.',
  })
  @Post('me/profile-correction-request')
  async createProfileCorrectionRequest(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateProfileCorrectionRequestDto,
  ) {
    return this.usersService.createProfileCorrectionRequest(userId, dto);
  }

  @ApiOperation({
    summary: 'Kullanıcıları listeler (SUPER_ADMIN veya canManageUsers yetkili STAFF erişebilir)',
  })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'offset', type: Number, required: false })
  @Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
  @Get()
  async listUsers(
    @CurrentUser() currentUser: { sub: string; role: UserRole },
    @Query('role') role?: UserRole,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<UserResponseDto[]> {
    const safeLimit = Math.min(100, Math.max(1, limit ? Number(limit) : 50));
    const safeOffset = Math.max(0, offset ? Number(offset) : 0);
    return this.usersService.listUsers(
      { id: currentUser.sub, role: currentUser.role },
      role,
      safeLimit,
      safeOffset,
    );
  }
}

@ApiTags('Admin / Staff Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({
    summary: 'Yeni personel hesabı oluşturur (Yalnızca SUPER_ADMIN)',
    description: 'Personelin telefon, e-posta, parola ve modül yetkilerini tanımlar.',
  })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @Post()
  async createStaff(@Body() dto: CreateStaffDto): Promise<UserResponseDto> {
    return this.usersService.createStaff(dto);
  }

  @ApiOperation({
    summary: 'Personel yetkilerini günceller (Yalnızca SUPER_ADMIN)',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @Patch(':id/permissions')
  async updateStaffPermissions(
    @Param('id') staffId: string,
    @Body() dto: UpdateStaffPermissionsDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateStaffPermissions(staffId, dto);
  }

  @ApiOperation({
    summary: 'Personeli pasifleştirir ve tüm aktif oturumlarını kapatır (Yalnızca SUPER_ADMIN)',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @Patch(':id/deactivate')
  async deactivateStaff(@Param('id') staffId: string): Promise<UserResponseDto> {
    return this.usersService.deactivateStaff(staffId);
  }
}

@ApiTags('Admin / Profile Corrections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/profile-corrections')
export class AdminProfileCorrectionController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({
    summary: 'Müşteri profil düzeltme taleplerini listeler (Yalnızca SUPER_ADMIN)',
    description: 'Bekleyen veya sonuçlanmış kimlik düzeltme taleplerini sayfalamalı standart zarfta sunar.',
  })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  @Get()
  async listCorrections(
    @Query() query: ProfileCorrectionQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.usersService.getPaginatedProfileCorrections(query);
  }

  @ApiOperation({
    summary: 'Müşteri profil düzeltme talebini inceler (Onay / Red - Yalnızca SUPER_ADMIN)',
    description:
      'Onaylandığında CustomerProfile tablosu atomik olarak güncellenir (HMAC ve AES şifreleme yenilenir) ve denetim kaydı oluşturulur.',
  })
  @Patch(':id/review')
  async reviewCorrection(
    @CurrentUser('sub') adminUserId: string,
    @Param('id') requestId: string,
    @Body() dto: ReviewProfileCorrectionDto,
  ) {
    return this.usersService.reviewProfileCorrection(requestId, adminUserId, dto);
  }
}
