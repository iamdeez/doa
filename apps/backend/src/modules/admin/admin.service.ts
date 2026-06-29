import { Injectable } from '@nestjs/common';
import { SellerStatus } from '@prisma/client';
import { SellerProfile, SellerService } from '../seller/seller.service';
import { AdminUserListItem, UserService } from '../user/user.service';
import {
  DEFAULT_USER_PAGE_LIMIT,
  MAX_USER_PAGE_LIMIT,
} from './admin.constants';

/**
 * 운영 관리 서비스 — 기존 도메인 Service 조합 (P-001: 자체 테이블 없음).
 * 판매자 승인 로직은 seller 도메인에 이미 존재하므로 중복 구현하지 않고 SellerService.approve 를 호출한다.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly sellerService: SellerService,
    private readonly userService: UserService,
  ) {}

  // ── 판매자 운영 ──────────────────────────────────────────────────

  /** 승인 대기(PENDING) 판매자 목록. */
  async listPendingSellers(): Promise<SellerProfile[]> {
    return this.sellerService.listByStatus(SellerStatus.PENDING);
  }

  /** 판매자 승인 — seller 도메인의 기존 승인 로직(PENDING→APPROVED) 재사용. */
  async approveSeller(sellerId: string): Promise<SellerProfile> {
    return this.sellerService.approve(sellerId);
  }

  // ── 사용자 운영 ──────────────────────────────────────────────────

  /** 사용자 목록 — cursor 페이지네이션. limit 은 1..MAX 범위로 클램프. */
  async listUsers(
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<{ items: AdminUserListItem[]; nextCursor: string | null }> {
    const take = Math.min(
      Math.max(limit ?? DEFAULT_USER_PAGE_LIMIT, 1),
      MAX_USER_PAGE_LIMIT,
    );
    return this.userService.listUsersForAdmin(cursor, take);
  }
}
