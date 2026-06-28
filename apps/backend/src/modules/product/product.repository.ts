import { Injectable } from '@nestjs/common';
import {
  Category,
  Prisma,
  Product,
  ProductImage,
  ProductStatus,
  Variant,
} from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: products 스키마(products.categories, products.products, products.product_images, products.variants)에만 접근.
// inventory 접근은 InventoryService DI 경유. user/seller 직접 접근 없음.

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Category ──────────────────────────────────────────────────────

  async findCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  async findCategoryById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  // ── Product ───────────────────────────────────────────────────────

  async createProduct(data: {
    sellerId: string;
    categoryId: string;
    title: string;
    description?: string;
    price: Prisma.Decimal | number | string;
  }): Promise<Product> {
    return this.prisma.product.create({ data: { ...data, status: ProductStatus.DRAFT } });
  }

  async findById(id: string): Promise<(Product & { images: ProductImage[]; variants: Variant[] }) | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: { images: { orderBy: { displayOrder: 'asc' } }, variants: true },
    });
  }

  async updateProduct(
    id: string,
    data: {
      categoryId?: string;
      title?: string;
      description?: string | null;
      price?: Prisma.Decimal | number | string;
    },
  ): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: ProductStatus): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data: { status } });
  }

  /**
   * 공개 상품 목록 (cursor 기반 페이지네이션, ADR-007, NFR-001):
   * status IN [ACTIVE, OUT_OF_STOCK], orderBy [createdAt desc, id desc].
   */
  async listPublic(
    cursor: string | undefined,
    take: number,
  ): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { status: { in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take,
    });
  }

  async listBySeller(sellerId: string): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Variant ───────────────────────────────────────────────────────

  async findVariantById(id: string): Promise<Variant | null> {
    return this.prisma.variant.findUnique({ where: { id } });
  }

  async createVariant(data: {
    productId: string;
    optionName: string;
    optionValue: string;
    sku: string;
    price: Prisma.Decimal | number | string;
  }): Promise<Variant> {
    return this.prisma.variant.create({ data });
  }

  async updateVariant(
    id: string,
    data: {
      optionName?: string;
      optionValue?: string;
      sku?: string;
      price?: Prisma.Decimal | number | string;
    },
  ): Promise<Variant> {
    return this.prisma.variant.update({ where: { id }, data });
  }

  async deleteVariant(id: string): Promise<void> {
    await this.prisma.variant.delete({ where: { id } });
  }

  // ── ProductImage ─────────────────────────────────────────────────

  async countImages(productId: string): Promise<number> {
    return this.prisma.productImage.count({ where: { productId } });
  }

  async createImage(data: {
    productId: string;
    url: string;
    displayOrder?: number;
  }): Promise<ProductImage> {
    return this.prisma.productImage.create({ data });
  }

  async deleteImage(id: string): Promise<void> {
    await this.prisma.productImage.delete({ where: { id } });
  }
}
