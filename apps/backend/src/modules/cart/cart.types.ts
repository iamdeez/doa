import { Prisma } from '@prisma/client';

/** JSONB cart.items 배열 원소 타입. Decimal은 JSON 직렬화 시 string으로 저장. */
export interface CartItem {
  variantId: string;
  productId: string;
  sellerId: string;
  quantity: number;
  /** Prisma Decimal → JSON 직렬화 시 string */
  unitPrice: string;
  optionName: string;
  optionValue: string;
  productTitle: string;
  sku: string;
}

export function decimalToString(d: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(d).toFixed(2);
}
