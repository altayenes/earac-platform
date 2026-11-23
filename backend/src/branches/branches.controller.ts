import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBranchDto,
  UpdateBranchDto,
  BranchResponseDto,
} from './dto/branch.dto';

@ApiTags('Branches')
@Controller('branches')
export class BranchesController {
  constructor(
    private branchesService: BranchesService,
    private prisma: PrismaService,
  ) {}

  @ApiOperation({
    summary: 'Şubeleri listeler (Herkese Açık)',
    description: 'Varsayılan olarak yalnızca aktif şubeleri döner.',
  })
  @ApiResponse({ status: 200, type: [BranchResponseDto] })
  @ApiQuery({ name: 'all', type: Boolean, required: false, description: 'Tümünü listelemek için true' })
  @Get()
  async getBranches(@Query('all') all?: string): Promise<BranchResponseDto[]> {
    const onlyActive = all !== 'true';
    return this.branchesService.findAll(onlyActive);
  }

  @ApiOperation({ summary: 'Şube detayını getirir (Herkese Açık)' })
  @ApiResponse({ status: 200, type: BranchResponseDto })
  @Get(':id')
  async getBranchById(@Param('id') id: string): Promise<BranchResponseDto> {
    return this.branchesService.findById(id);
  }

  @ApiOperation({
    summary: 'Yeni şube oluşturur (SUPER_ADMIN veya canManageBranches yetkili STAFF)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
  @ApiResponse({ status: 201, type: BranchResponseDto })
  @Post()
  async createBranch(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreateBranchDto,
  ): Promise<BranchResponseDto> {
    await this.assertStaffPermission(user, 'canManageBranches');
    return this.branchesService.create(dto, user.sub);
  }

  @ApiOperation({
    summary: 'Şube bilgilerini günceller (SUPER_ADMIN veya canManageBranches yetkili STAFF)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
  @ApiResponse({ status: 200, type: BranchResponseDto })
  @Patch(':id')
  async updateBranch(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    await this.assertStaffPermission(user, 'canManageBranches');
    return this.branchesService.update(id, dto, user.sub);
  }

  @ApiOperation({
    summary: 'Şubeyi pasife alır (Fiziksel silme yasaktır, isActive: false yapılır)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
  @ApiResponse({ status: 200, type: BranchResponseDto })
  @Delete(':id')
  async deactivateBranch(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
  ): Promise<BranchResponseDto> {
    await this.assertStaffPermission(user, 'canManageBranches');
    return this.branchesService.deactivate(id, user.sub);
  }

  private async assertStaffPermission(
    user: { sub: string; role: UserRole },
    field: 'canManageBranches',
  ) {
    if (user.role === UserRole.SUPER_ADMIN) return;
    const perm = await this.prisma.staffPermission.findUnique({
      where: { userId: user.sub },
    });
    if (!perm || !perm[field]) {
      throw new ForbiddenException(`Bu işlem için ${field} yetkisi gereklidir.`);
    }
  }
}
