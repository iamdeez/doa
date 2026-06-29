/**
 * FileService 단위 테스트 — [env:unit]
 *
 * 검증 대상 (006-file):
 *   - presign(): 키 형식 {purpose}/{userId}/{uuid}, storage port 호출, PENDING 레코드 생성, 응답 구조
 *   - getById(): 미존재 404
 *   - delete(): 미존재 404, 타인 소유 403, 본인 소유 삭제
 *
 * StubFileStorage 결정적 URL 검증 포함 (외부 네트워크 호출 없음 — P-002).
 */

import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FilePurpose, FileStatus } from '@prisma/client';
import { FILE_STORAGE } from './file-storage.port';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { StubFileStorage } from './stub-file-storage';

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn(),
};

const USER_ID = 'user-001';
const OTHER_USER_ID = 'user-002';
const FILE_ID = 'file-001';

describe('FileService', () => {
  let service: FileService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: FileRepository, useValue: mockRepo },
        { provide: FILE_STORAGE, useClass: StubFileStorage },
      ],
    }).compile();
    service = moduleRef.get<FileService>(FileService);
  });

  describe('presign', () => {
    it('when_presign_then_key_format_and_pending_record_created', async () => {
      mockRepo.create.mockImplementation((data) =>
        Promise.resolve({ id: FILE_ID, ...data }),
      );

      const result = await service.presign(USER_ID, {
        purpose: FilePurpose.PRODUCT_IMAGE,
        contentType: 'image/png',
      });

      // 키 형식: {purpose}/{userId}/{uuid}
      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.key).toMatch(
        new RegExp(`^${FilePurpose.PRODUCT_IMAGE}/${USER_ID}/[0-9a-f-]{36}$`),
      );
      expect(createArg).toMatchObject({
        ownerId: USER_ID,
        purpose: FilePurpose.PRODUCT_IMAGE,
        contentType: 'image/png',
        size: 0,
        status: FileStatus.PENDING,
      });

      // 응답 구조: id, key, uploadUrl, url
      expect(result).toMatchObject({
        id: FILE_ID,
        key: createArg.key,
      });
      // stub 결정적 URL
      expect(result.uploadUrl).toBe(
        `https://r2.stub.local/${createArg.key}?presigned=upload`,
      );
      expect(result.url).toBe(`https://r2.stub.local/${createArg.key}`);
    });

    it('when_presign_twice_then_keys_are_unique', async () => {
      mockRepo.create.mockImplementation((data) =>
        Promise.resolve({ id: FILE_ID, ...data }),
      );

      const r1 = await service.presign(USER_ID, {
        purpose: FilePurpose.PROFILE,
        contentType: 'image/jpeg',
      });
      const r2 = await service.presign(USER_ID, {
        purpose: FilePurpose.PROFILE,
        contentType: 'image/jpeg',
      });

      expect(r1.key).not.toBe(r2.key);
    });
  });

  describe('getById', () => {
    it('when_missing_then_NotFound', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.getById(FILE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('when_found_then_returns_meta', async () => {
      const file = { id: FILE_ID, ownerId: USER_ID };
      mockRepo.findById.mockResolvedValue(file);
      await expect(service.getById(FILE_ID)).resolves.toBe(file);
    });
  });

  describe('delete', () => {
    it('when_missing_then_NotFound', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.delete(USER_ID, FILE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('when_owned_by_other_then_Forbidden', async () => {
      mockRepo.findById.mockResolvedValue({
        id: FILE_ID,
        ownerId: OTHER_USER_ID,
      });
      await expect(service.delete(USER_ID, FILE_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('when_owned_by_user_then_deletes', async () => {
      mockRepo.findById.mockResolvedValue({ id: FILE_ID, ownerId: USER_ID });
      mockRepo.delete.mockResolvedValue(undefined);

      await service.delete(USER_ID, FILE_ID);

      expect(mockRepo.delete).toHaveBeenCalledWith(FILE_ID);
    });
  });
});
