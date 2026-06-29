import { Injectable } from '@nestjs/common';
import { Seller, SellerStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: users 스키마(users.sellers)에만 접근. 타 스키마 미접근.

@Injectable()
export class SellerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSeller(data: {
    userId: string;
    businessName: string;
    businessNumber: string;
    representativeName: string;
    contactPhone?: string;
    businessAddress?: string;
  }): Promise<Seller> {
    return this.prisma.seller.create({ data });
  }

  async findByUserId(userId: string): Promise<Seller | null> {
    return this.prisma.seller.findUnique({ where: { userId } });
  }

  async findById(id: string): Promise<Seller | null> {
    return this.prisma.seller.findUnique({ where: { id } });
  }

  /** 전체 판매자 수 — 관리자 통계용 (007-stats, additive). */
  async countAll(): Promise<number> {
    return this.prisma.seller.count();
  }

  /** 상태별 판매자 목록 — 관리자 조회용 (007-admin, additive). 최신순. */
  async listByStatus(status: SellerStatus): Promise<Seller[]> {
    return this.prisma.seller.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSeller(
    id: string,
    data: {
      businessName?: string;
      businessNumber?: string;
      representativeName?: string;
      contactPhone?: string | null;
      businessAddress?: string | null;
    },
  ): Promise<Seller> {
    return this.prisma.seller.update({ where: { id }, data });
  }

  async updateStatus(
    id: string,
    status: SellerStatus,
    rejectReason?: string | null,
  ): Promise<Seller> {
    return this.prisma.seller.update({
      where: { id },
      data: { status, rejectReason: rejectReason ?? null },
    });
  }
}
