import { Injectable, Logger } from '@nestjs/common';
import {
  FileStoragePort,
  PresignedUpload,
} from './file-storage.port';

/** stub public URL base — 외부 네트워크 호출 없이 결정적 문자열 반환 */
const STUB_BASE_URL = 'https://r2.stub.local';

/**
 * 객체 스토리지 연동 스텁 — 결정적 URL 문자열만 반환(실제 네트워크 호출 없음).
 * 실제 R2 연동 시 이 클래스를 교체하거나 별도 구현체를 FILE_STORAGE 토큰으로 바인딩.
 */
@Injectable()
export class StubFileStorage implements FileStoragePort {
  private readonly logger = new Logger(StubFileStorage.name);

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    this.logger.log(`[STUB] presign key=${key} contentType=${contentType}`);
    return {
      uploadUrl: `${STUB_BASE_URL}/${key}?presigned=upload`,
      publicUrl: this.getPublicUrl(key),
    };
  }

  getPublicUrl(key: string): string {
    return `${STUB_BASE_URL}/${key}`;
  }
}
