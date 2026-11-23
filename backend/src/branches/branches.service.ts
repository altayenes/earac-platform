import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';
import {
  CreateBranchDto,
  UpdateBranchDto,
  BranchResponseDto,
} from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(onlyActive = true): Promise<BranchResponseDto[]> {
    return this.prisma.branch.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<BranchResponseDto> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException('Şube bulunamadı');
    }

    return branch;
  }

  async create(dto: CreateBranchDto, userId?: string): Promise<BranchResponseDto> {
    const existing = await this.prisma.branch.findUnique({
      where: { name: dto.name.trim() },
    });

    if (existing) {
      throw new ConflictException('Bu isimde bir şube zaten mevcuttur');
    }

    const branch = await this.prisma.branch.create({
      data: {
        name: dto.name.trim(),
        address: dto.address.trim(),
        openingTime: dto.openingTime,
        closingTime: dto.closingTime,
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_CREATED, // or general audit
      performedByUserId: userId,
      details: { action: 'BRANCH_CREATED', branchId: branch.id, name: branch.name },
    });

    return branch;
  }

  async update(
    id: string,
    dto: UpdateBranchDto,
    userId?: string,
  ): Promise<BranchResponseDto> {
    await this.findById(id);

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.address !== undefined && { address: dto.address.trim() }),
        ...(dto.openingTime !== undefined && { openingTime: dto.openingTime }),
        ...(dto.closingTime !== undefined && { closingTime: dto.closingTime }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      performedByUserId: userId,
      details: { action: 'BRANCH_UPDATED', branchId: id, changes: dto },
    });

    return updated;
  }

  // Soft-delete: physical delete is forbidden
  async deactivate(id: string, userId?: string): Promise<BranchResponseDto> {
    await this.findById(id);

    const updated = await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      performedByUserId: userId,
      details: { action: 'BRANCH_DEACTIVATED', branchId: id },
    });

    return updated;
  }
}
