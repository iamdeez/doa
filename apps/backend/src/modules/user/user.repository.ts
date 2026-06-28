import { Injectable } from '@nestjs/common';
import { Address, Prisma, ProductView, User, Wishlist } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: users 스키마(users.users, users.addresses, users.wishlists, users.product_views)에만 접근.

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── User ──────────────────────────────────────────────────────────

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateUser(id: string, data: { name?: string; phone?: string }): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  // ── Address ──────────────────────────────────────────────────────

  async findAddressById(id: string): Promise<Address | null> {
    return this.prisma.address.findUnique({ where: { id } });
  }

  async findAddressesByUser(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(
    userId: string,
    data: {
      recipientName: string;
      phone: string;
      zipCode: string;
      address1: string;
      address2?: string;
      isDefault?: boolean;
    },
  ): Promise<Address> {
    return this.prisma.address.create({ data: { userId, ...data } });
  }

  async updateAddress(
    id: string,
    data: {
      recipientName?: string;
      phone?: string;
      zipCode?: string;
      address1?: string;
      address2?: string | null;
    },
  ): Promise<Address> {
    return this.prisma.address.update({ where: { id }, data });
  }

  async deleteAddress(id: string): Promise<void> {
    await this.prisma.address.delete({ where: { id } });
  }

  /**
   * 기본 배송지 단일성 보장 트랜잭션 (ADR-009):
   * 현재 기본 배송지를 false 로 일괄 해제 → 대상 배송지를 true 로 설정.
   */
  async setDefaultTx(userId: string, addressId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
    ]);
  }

  /**
   * 기본 배송지 삭제 + 잔여 최신 1건 재지정 트랜잭션 (ADR-008).
   * 잔여 배송지 없으면 재지정 생략.
   */
  async deleteAddressWithReassign(
    userId: string,
    addressId: string,
    wasDefault: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.address.delete({ where: { id: addressId } });

      if (wasDefault) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
        if (next) {
          await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
        }
      }
    });
  }

  // ── Wishlist ──────────────────────────────────────────────────────

  async findWishlistsByUser(userId: string): Promise<Wishlist[]> {
    return this.prisma.wishlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWishlist(userId: string, productId: string): Promise<Wishlist> {
    return this.prisma.wishlist.create({ data: { userId, productId } });
  }

  async deleteWishlist(userId: string, productId: string): Promise<void> {
    await this.prisma.wishlist.deleteMany({ where: { userId, productId } });
  }

  // ── ProductView ───────────────────────────────────────────────────

  async upsertProductView(userId: string, productId: string): Promise<ProductView> {
    return this.prisma.productView.upsert({
      where: { userId_productId: { userId, productId } },
      update: { viewedAt: new Date() },
      create: { userId, productId },
    });
  }

  async findRecentViews(userId: string, take: number): Promise<ProductView[]> {
    return this.prisma.productView.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
      take,
    });
  }
}
