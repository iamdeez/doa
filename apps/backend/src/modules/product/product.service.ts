import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, ProductStatus } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { SellerService } from '../seller/seller.service';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, MAX_PRODUCT_IMAGES } from './product.constants';
import { ProductRepository } from './product.repository';

export interface ProductListResult {
  items: unknown[];
  nextCursor: string | null;
}

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly sellerService: SellerService,
    private readonly inventoryService: InventoryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Category ──────────────────────────────────────────────────────

  async listCategories() {
    return this.productRepository.findCategories();
  }

  // ── Product CRUD ──────────────────────────────────────────────────

  async createProduct(
    userId: string,
    data: {
      categoryId: string;
      title: string;
      description?: string;
      price: number | string;
    },
  ) {
    const seller = await this.sellerService.getApprovedSeller(userId);
    const category = await this.productRepository.findCategoryById(data.categoryId);
    if (!category) throw new BadRequestException('Category not found');

    return this.productRepository.createProduct({
      sellerId: seller.id,
      ...data,
      price: new Prisma.Decimal(data.price),
    });
  }

  async updateProduct(
    userId: string,
    productId: string,
    data: {
      categoryId?: string;
      title?: string;
      description?: string | null;
      price?: number | string;
    },
  ) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    await this.assertOwner(userId, product.sellerId);

    const updateData: Parameters<ProductRepository['updateProduct']>[1] = { ...data };
    if (data.price !== undefined) {
      updateData.price = new Prisma.Decimal(data.price);
    }
    return this.productRepository.updateProduct(productId, updateData);
  }

  async publish(userId: string, productId: string) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    await this.assertOwner(userId, product.sellerId);

    if (product.status !== ProductStatus.DRAFT && product.status !== ProductStatus.INACTIVE) {
      throw new BadRequestException(`Cannot publish product with status ${product.status}`);
    }
    return this.productRepository.updateStatus(productId, ProductStatus.ACTIVE);
  }

  async deactivate(userId: string, productId: string) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    await this.assertOwner(userId, product.sellerId);

    if (
      product.status !== ProductStatus.ACTIVE &&
      product.status !== ProductStatus.OUT_OF_STOCK
    ) {
      throw new BadRequestException(`Cannot deactivate product with status ${product.status}`);
    }
    return this.productRepository.updateStatus(productId, ProductStatus.INACTIVE);
  }

  // ── Variant ───────────────────────────────────────────────────────

  async addVariant(
    userId: string,
    productId: string,
    data: {
      optionName: string;
      optionValue: string;
      sku: string;
      price: number | string;
      initialStock?: number;
    },
  ) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    await this.assertOwner(userId, product.sellerId);

    const variant = await this.productRepository.createVariant({
      productId,
      optionName: data.optionName,
      optionValue: data.optionValue,
      sku: data.sku,
      price: new Prisma.Decimal(data.price),
    });

    const initialStock = data.initialStock ?? 0;
    await this.inventoryService.initStock(variant.id, productId, initialStock);

    return variant;
  }

  async updateVariant(
    userId: string,
    productId: string,
    variantId: string,
    data: {
      optionName?: string;
      optionValue?: string;
      sku?: string;
      price?: number | string;
    },
  ) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    await this.assertOwner(userId, product.sellerId);

    const variant = await this.productRepository.findVariantById(variantId);
    if (!variant || variant.productId !== productId) throw new NotFoundException('Variant not found');

    const updateData: Parameters<ProductRepository['updateVariant']>[1] = { ...data };
    if (data.price !== undefined) {
      updateData.price = new Prisma.Decimal(data.price);
    }
    return this.productRepository.updateVariant(variantId, updateData);
  }

  async deleteVariant(userId: string, productId: string, variantId: string) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    await this.assertOwner(userId, product.sellerId);

    const variant = await this.productRepository.findVariantById(variantId);
    if (!variant || variant.productId !== productId) throw new NotFoundException('Variant not found');

    await this.productRepository.deleteVariant(variantId);
  }

  // ── Image ─────────────────────────────────────────────────────────

  async addImage(
    userId: string,
    productId: string,
    data: { url: string; displayOrder?: number },
  ) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    await this.assertOwner(userId, product.sellerId);

    const count = await this.productRepository.countImages(productId);
    if (count >= MAX_PRODUCT_IMAGES) {
      throw new BadRequestException(`Maximum ${MAX_PRODUCT_IMAGES} images per product`);
    }
    return this.productRepository.createImage({ productId, ...data });
  }

  async deleteImage(userId: string, productId: string, imageId: string) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    await this.assertOwner(userId, product.sellerId);
    await this.productRepository.deleteImage(imageId);
  }

  // ── Public listing ────────────────────────────────────────────────

  async listPublic(cursor: string | undefined, limit: number | undefined): Promise<ProductListResult> {
    const take = Math.min(Math.max(limit ?? DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);
    const items = await this.productRepository.listPublic(cursor, take);
    const nextCursor = items.length === take ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }

  async getDetail(productId: string, user?: { userId: string }) {
    const product = await this.productRepository.findById(productId);
    if (
      !product ||
      (product.status !== ProductStatus.ACTIVE && product.status !== ProductStatus.OUT_OF_STOCK)
    ) {
      throw new NotFoundException('Product not found');
    }

    if (user) {
      this.eventEmitter.emit('product.viewed', { userId: user.userId, productId });
    }

    return product;
  }

  async listMyProducts(userId: string) {
    const seller = await this.sellerService.getApprovedSeller(userId);
    return this.productRepository.listBySeller(seller.id);
  }

  // ── Private helpers ───────────────────────────────────────────────

  /**
   * 상품 소유 검증: 현재 사용자의 sellerId 가 product.sellerId 와 일치해야 함 (cross-schema plain String 비교).
   * 불일치 시 ForbiddenException.
   */
  private async assertOwner(userId: string, productSellerId: string): Promise<void> {
    // sellerId 는 cross-schema plain String — SellerService DI 로 검증
    const seller = await this.sellerService.getApprovedSeller(userId);
    if (seller.id !== productSellerId) {
      throw new ForbiddenException('You do not own this product');
    }
  }
}
