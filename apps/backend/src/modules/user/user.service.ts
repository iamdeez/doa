import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MAX_PRODUCT_VIEWS } from './user.constants';
import { UserRepository } from './user.repository';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

export interface AddressData {
  id: string;
  userId: string;
  recipientName: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string | null;
  isDefault: boolean;
  createdAt: Date;
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: Date;
}

export interface RecentView {
  id: string;
  userId: string;
  productId: string;
  viewedAt: Date;
}

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  // ── Profile ───────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    return { id: user.id, email: user.email, name: user.name, phone: user.phone };
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string }): Promise<UserProfile> {
    const user = await this.userRepository.updateUser(userId, data);
    return { id: user.id, email: user.email, name: user.name, phone: user.phone };
  }

  // ── Address ───────────────────────────────────────────────────────

  async listAddresses(userId: string): Promise<AddressData[]> {
    return this.userRepository.findAddressesByUser(userId);
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
  ): Promise<AddressData> {
    return this.userRepository.createAddress(userId, data);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    data: {
      recipientName?: string;
      phone?: string;
      zipCode?: string;
      address1?: string;
      address2?: string | null;
    },
  ): Promise<AddressData> {
    const address = await this.userRepository.findAddressById(addressId);
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Access denied');
    return this.userRepository.updateAddress(addressId, data);
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.userRepository.findAddressById(addressId);
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Access denied');
    await this.userRepository.deleteAddressWithReassign(userId, addressId, address.isDefault);
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.userRepository.findAddressById(addressId);
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Access denied');
    await this.userRepository.setDefaultTx(userId, addressId);
  }

  // ── Wishlist ──────────────────────────────────────────────────────

  async listWishlist(userId: string): Promise<WishlistItem[]> {
    return this.userRepository.findWishlistsByUser(userId);
  }

  async addWishlist(userId: string, productId: string): Promise<WishlistItem> {
    try {
      return await this.userRepository.createWishlist(userId, productId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Already in wishlist');
      }
      throw err;
    }
  }

  async removeWishlist(userId: string, productId: string): Promise<void> {
    await this.userRepository.deleteWishlist(userId, productId);
  }

  // ── ProductView ───────────────────────────────────────────────────

  async listRecentViews(userId: string): Promise<RecentView[]> {
    return this.userRepository.findRecentViews(userId, MAX_PRODUCT_VIEWS);
  }

  /** product.viewed 이벤트 핸들러(UserEventsHandler)가 호출. */
  async recordProductView(userId: string, productId: string): Promise<void> {
    await this.userRepository.upsertProductView(userId, productId);
  }
}
