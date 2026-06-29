/**
 * 객체 스토리지(R2) 연동 인터페이스 — P-002: 외부 SDK 미사용(stub 추상화).
 * 실제 업로드는 클라이언트가 presigned URL 로 직접 PUT 하는 모델.
 */
export interface PresignedUpload {
  /** 클라이언트가 PUT 으로 업로드할 presigned URL */
  uploadUrl: string;
  /** 업로드 완료 후 접근할 public URL */
  publicUrl: string;
}

export interface FileStoragePort {
  /** 업로드용 presigned URL + 최종 public URL 발급 */
  getPresignedUploadUrl(key: string, contentType: string): Promise<PresignedUpload>;

  /** 객체 키 → public URL */
  getPublicUrl(key: string): string;
}

/** DI 토큰 */
export const FILE_STORAGE = 'FILE_STORAGE' as const;
