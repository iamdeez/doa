import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileAsset, FilePurpose, FileStatus } from '@prisma/client';
import { FILE_STORAGE, FileStoragePort } from './file-storage.port';
import { FileRepository } from './file.repository';
import { ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE_BYTES } from './file.constants';

export interface PresignResult {
  id: string;
  key: string;
  uploadUrl: string;
  url: string;
}

/**
 * 파일 메타데이터 도메인 (006-file).
 * 실제 바이너리는 클라이언트가 presigned URL 로 직접 업로드하고, 서버는 메타만 관리한다.
 * 객체 스토리지 연동은 FileStoragePort(stub) 추상화 — P-002.
 */
@Injectable()
export class FileService {
  constructor(
    private readonly fileRepository: FileRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
  ) {}

  /**
   * presigned upload URL 발급 + 메타데이터(PENDING) 레코드 생성.
   * 객체 키 = {purpose}/{userId}/{uuid} 형태.
   */
  async presign(
    userId: string,
    data: { purpose: FilePurpose; contentType: string },
  ): Promise<PresignResult> {
    // SEC-FIND-006-02: contentType allowlist — 허용 이미지 MIME 만 presign.
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(data.contentType)) {
      throw new BadRequestException(
        `Unsupported contentType: ${data.contentType}`,
      );
    }

    const key = `${data.purpose}/${userId}/${randomUUID()}`;
    const { uploadUrl, publicUrl } = await this.storage.getPresignedUploadUrl(
      key,
      data.contentType,
    );

    const file = await this.fileRepository.create({
      ownerId: userId,
      purpose: data.purpose,
      key,
      url: publicUrl,
      contentType: data.contentType,
      size: 0,
      status: FileStatus.PENDING,
    });

    return { id: file.id, key: file.key, uploadUrl, url: file.url };
  }

  /** 파일 메타 조회 — 소유자 전용(SEC-FIND-006-01 IDOR 차단). 미존재 → 404, 타인 소유 → 403 */
  async getById(userId: string, id: string): Promise<FileAsset> {
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.ownerId !== userId) {
      throw new ForbiddenException('Not your file');
    }
    return file;
  }

  /**
   * 업로드 확정 — 소유자가 presigned URL 업로드 완료 후 호출(GAP-006-02).
   * PENDING → UPLOADED 전이 + size 기록. 미존재 → 404, 타인 소유 → 403,
   * 이미 UPLOADED → 멱등(그대로 반환), size 범위 위반 → 400.
   */
  async confirm(userId: string, id: string, size: number): Promise<FileAsset> {
    if (!Number.isInteger(size) || size <= 0 || size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `size must be an integer in 1..${MAX_FILE_SIZE_BYTES}`,
      );
    }
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.ownerId !== userId) {
      throw new ForbiddenException('Not your file');
    }
    if (file.status === FileStatus.UPLOADED) {
      return file; // 멱등
    }
    return this.fileRepository.updateStatus(id, FileStatus.UPLOADED, size);
  }

  /** 파일 삭제. 미존재 → 404, 타인 소유 → 403 */
  async delete(userId: string, id: string): Promise<void> {
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.ownerId !== userId) {
      throw new ForbiddenException('Not your file');
    }
    await this.fileRepository.delete(id);
  }
}
