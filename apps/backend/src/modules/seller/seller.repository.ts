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
