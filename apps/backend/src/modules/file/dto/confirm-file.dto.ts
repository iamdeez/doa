import { IsInt, Min } from 'class-validator';

/** POST /files/:id/confirm body (011 GAP-006-02) — 업로드 완료 후 실제 크기 보고 */
export class ConfirmFileDto {
  /** 업로드된 파일 크기(byte). 상한은 service(MAX_FILE_SIZE_BYTES)에서 검증. */
  @IsInt()
  @Min(1)
  size!: number;
}
