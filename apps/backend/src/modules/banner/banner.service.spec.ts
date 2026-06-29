/**
 * BannerService 단위 테스트 — 007-banner [env:unit]
 *
 * 시나리오:
 *   - CRUD: 생성/부분수정/삭제, 미존재 시 NotFoundException
 *   - 공개 노출 필터: isActive=true + 노출기간(startsAt≤now≤endsAt, null=무제한)
 *   - sortOrder 순 유지 (repository 정렬 위임)
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Banner, BannerPosition } from '@prisma/client';
import { BannerService } from './banner.service';
import { BannerRepository } from './banner.repository';

const mockBannerRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  listAll: jest.fn(),
  listActiveOrdered: jest.fn(),
};

function makeBanner(overrides: Partial<Banner> = {}): Banner {
  return {
    id: 'b1',
    title: 'title',
    imageUrl: 'https://img/1.png',
    linkUrl: null,
    position: BannerPosition.MAIN_TOP,
    sortOrder: 0,
    isActive: true,
    startsAt: null,
    endsAt: null,
    createdAt: new Date('2026-06-01'),
    ...overrides,
  };
}

const NOW = new Date('2026-06-15T00:00:00Z');

describe('BannerService', () => {
  let service: BannerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BannerService,
        { provide: BannerRepository, useValue: mockBannerRepository },
      ],
    }).compile();

    service = module.get<BannerService>(BannerService);
  });

  // ── CRUD ───────────────────────────────────────────────────────────

  describe('create', () => {
    it('when_create_then_delegates_to_repository', async () => {
      const created = makeBanner({ id: 'new' });
      mockBannerRepository.create.mockResolvedValue(created);

      const result = await service.create({
        title: 't',
        imageUrl: 'https://img/x.png',
      });

      expect(mockBannerRepository.create).toHaveBeenCalledWith({
        title: 't',
        imageUrl: 'https://img/x.png',
      });
      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('when_exists_then_partial_update', async () => {
      mockBannerRepository.findById.mockResolvedValue(makeBanner());
      const updated = makeBanner({ title: 'changed' });
      mockBannerRepository.update.mockResolvedValue(updated);

      const result = await service.update('b1', { title: 'changed' });

      expect(mockBannerRepository.update).toHaveBeenCalledWith('b1', {
        title: 'changed',
      });
      expect(result.title).toBe('changed');
    });

    it('when_not_found_then_NotFoundException', async () => {
      mockBannerRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', { title: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockBannerRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('when_exists_then_deletes', async () => {
      mockBannerRepository.findById.mockResolvedValue(makeBanner());
      mockBannerRepository.delete.mockResolvedValue(undefined);

      await service.remove('b1');

      expect(mockBannerRepository.delete).toHaveBeenCalledWith('b1');
    });

    it('when_not_found_then_NotFoundException', async () => {
      mockBannerRepository.findById.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(mockBannerRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ── 공개 노출 필터 ─────────────────────────────────────────────────

  describe('listPublic', () => {
    it('when_no_period_then_always_visible', async () => {
      mockBannerRepository.listActiveOrdered.mockResolvedValue([
        makeBanner({ id: 'always', startsAt: null, endsAt: null }),
      ]);

      const result = await service.listPublic(NOW);

      expect(result.map((b) => b.id)).toEqual(['always']);
    });

    it('when_now_inside_period_then_visible', async () => {
      mockBannerRepository.listActiveOrdered.mockResolvedValue([
        makeBanner({
          id: 'inside',
          startsAt: new Date('2026-06-10T00:00:00Z'),
          endsAt: new Date('2026-06-20T00:00:00Z'),
        }),
      ]);

      const result = await service.listPublic(NOW);

      expect(result.map((b) => b.id)).toEqual(['inside']);
    });

    it('when_not_yet_started_then_hidden', async () => {
      mockBannerRepository.listActiveOrdered.mockResolvedValue([
        makeBanner({
          id: 'future',
          startsAt: new Date('2026-06-20T00:00:00Z'),
          endsAt: null,
        }),
      ]);

      const result = await service.listPublic(NOW);

      expect(result).toHaveLength(0);
    });

    it('when_already_ended_then_hidden', async () => {
      mockBannerRepository.listActiveOrdered.mockResolvedValue([
        makeBanner({
          id: 'past',
          startsAt: null,
          endsAt: new Date('2026-06-10T00:00:00Z'),
        }),
      ]);

      const result = await service.listPublic(NOW);

      expect(result).toHaveLength(0);
    });

    it('when_mixed_then_only_active_within_period_in_order', async () => {
      // listActiveOrdered 는 이미 isActive=true 만, sortOrder 순으로 반환한다고 가정.
      mockBannerRepository.listActiveOrdered.mockResolvedValue([
        makeBanner({ id: 'a', sortOrder: 0, startsAt: null, endsAt: null }),
        makeBanner({
          id: 'b-future',
          sortOrder: 1,
          startsAt: new Date('2026-07-01T00:00:00Z'),
        }),
        makeBanner({
          id: 'c',
          sortOrder: 2,
          startsAt: new Date('2026-06-01T00:00:00Z'),
          endsAt: new Date('2026-06-30T00:00:00Z'),
        }),
      ]);

      const result = await service.listPublic(NOW);

      expect(result.map((b) => b.id)).toEqual(['a', 'c']);
    });

    it('when_boundary_equals_now_then_visible', async () => {
      mockBannerRepository.listActiveOrdered.mockResolvedValue([
        makeBanner({ id: 'startsNow', startsAt: NOW, endsAt: null }),
        makeBanner({ id: 'endsNow', startsAt: null, endsAt: NOW }),
      ]);

      const result = await service.listPublic(NOW);

      expect(result.map((b) => b.id)).toEqual(['startsNow', 'endsNow']);
    });
  });
});
