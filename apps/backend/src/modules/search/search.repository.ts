import { Injectable } from '@nestjs/common';

/**
 * search 도메인은 자체 소유 테이블이 없다 (P-001).
 * 모든 상품 조회는 ProductService 공개 메서드 DI 경유로 수행하므로
 * 본 Repository 는 직접 Prisma 접근을 갖지 않는다.
 * (4계층 골격 유지를 위해 클래스만 보존 — SearchModule providers 미등록)
 */
@Injectable()
export class SearchRepository {}
