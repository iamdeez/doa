import { Injectable, NotFoundException } from '@nestjs/common';
import { Banner, BannerPosition } from '@prisma/client';
import { BannerRepository } from './banner.repository';

export interface CreateBannerInput {
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  position?: BannerPosition;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface UpdateBannerInput {
  title?: string;
  imageUrl?: string;
  linkUrl?: string | null;
  position?: BannerPosition;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

@Injectable()
export class BannerService {
  constructor(private readonly bannerRepository: BannerRepository) {}

  // ── 관리자 CRUD ──────────────────────────────────────────────────

  async create(input: CreateBannerInput): Promise<Banner> {
    return this.bannerRepository.create(input);
  }

  /** 부분 수정 — 존재하지 않으면 404. 전달된 필드만 갱신. */
  async update(id: string, input: UpdateBannerInput): Promise<Banner> {
    const existing = await this.bannerRepository.findById(id);
    if (!existing) throw new NotFoundException('Banner not found');
    return this.bannerRepository.update(id, input);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.bannerRepository.findById(id);
    if (!existing) throw new NotFoundException('Banner not found');
    await this.bannerRepository.delete(id);
  }

  /** 관리자 전체 목록 (활성/비활성 모두). */
  async listAll(): Promise<Banner[]> {
    return this.bannerRepository.listAll();
  }

  // ── 공개 노출 ────────────────────────────────────────────────────

  /**
   * 공개 노출 배너 — 활성(isActive=true) + 노출기간 필터.
   * 노출기간 판정 (now 기준):
   *   - startsAt 이 null 이거나 startsAt ≤ now
   *   - endsAt 이 null 이거나 now ≤ endsAt
   * 두 조건을 모두 만족하는 배너만 sortOrder 순으로 반환한다.
   */
  async listPublic(now: Date = new Date()): Promise<Banner[]> {
    const active = await this.bannerRepository.listActiveOrdered();
    return active.filter((banner) => this.isWithinPeriod(banner, now));
  }

  private isWithinPeriod(banner: Banner, now: Date): boolean {
    const startedOk = banner.startsAt === null || banner.startsAt <= now;
    const notEndedOk = banner.endsAt === null || now <= banner.endsAt;
    return startedOk && notEndedOk;
  }
}
