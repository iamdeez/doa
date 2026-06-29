import { Injectable } from '@nestjs/common';
import { Banner, BannerPosition } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: banner 모듈은 자신의 소유 테이블(admin.banners)에만 접근. 타 스키마 미접근.
// 접근자: this.prisma.banner (루트 클라이언트 직접). 트랜잭션 비참여 standalone CRUD/조회라
// ALS tx-aware 접근(this.prisma.tx.*)이 불필요하며, tx 게터는 트랜잭션 외부에서 모델 델리게이트가
// 해소되지 않으므로(루트 Proxy 가 아닌 raw target 반환) 직접 접근이 정확하다 (002-catalog 동일 패턴).

@Injectable()
export class BannerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    title: string;
    imageUrl: string;
    linkUrl?: string | null;
    position?: BannerPosition;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }): Promise<Banner> {
    return this.prisma.banner.create({ data });
  }

  async findById(id: string): Promise<Banner | null> {
    return this.prisma.banner.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: {
      title?: string;
      imageUrl?: string;
      linkUrl?: string | null;
      position?: BannerPosition;
      sortOrder?: number;
      isActive?: boolean;
      startsAt?: Date | null;
      endsAt?: Date | null;
    },
  ): Promise<Banner> {
    return this.prisma.banner.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.banner.delete({ where: { id } });
  }

  /** 관리자 전체 목록 — sortOrder 오름차순 후 최신순. */
  async listAll(): Promise<Banner[]> {
    return this.prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * 공개 노출 후보 — isActive=true 만 sortOrder 오름차순으로 반환.
   * 노출기간(startsAt/endsAt) 필터는 BannerService 에서 now 기준으로 적용한다.
   */
  async listActiveOrdered(): Promise<Banner[]> {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }
}
