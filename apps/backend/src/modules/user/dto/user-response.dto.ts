import { ApiProperty } from '@nestjs/swagger';

/**
 * 사용자 도메인 읽기 응답 DTO (문서 전용 — 런타임 변환 없음).
 * 프로필은 password 등 민감 필드를 제외한 안전 요약만 반환한다.
 * 찜·최근 본 상품은 현재 productId 만 반환한다(P-001 경계). 상품 요약 보강은 후속 spec.
 */
export class UserProfileResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ required: false, nullable: true })
  name?: string | null;

  @ApiProperty({ required: false, nullable: true })
  phone?: string | null;
}

export class AddressResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  recipientName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  zipCode!: string;

  @ApiProperty()
  address1!: string;

  @ApiProperty({ required: false, nullable: true })
  address2?: string | null;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

/** GET /users/me/wishlist — 찜 항목(productId 만, P-001). 상품 요약 미포함. */
export class WishlistResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ description: 'cross-schema plain String — products.products.id (P-001)' })
  productId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

/** GET /users/me/recent-views — 최근 본 상품(productId 만, P-001). */
export class RecentViewResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ description: 'cross-schema plain String — products.products.id (P-001)' })
  productId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  viewedAt!: string;
}
