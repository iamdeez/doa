'use client';

import { useRef, useState } from 'react';
import type { FilePurpose } from '@doa/shared-types';
import { api } from '@/lib/api';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/upload-constants';
import { LoadingState, ErrorState } from '@/components/states';

interface ImageUploadProps {
  purpose: FilePurpose;
  onUploaded: (publicUrl: string) => void;
  disabled?: boolean;
}

/**
 * 3단계 이미지 업로드 컴포넌트 (ADR-002).
 * presign → PUT(plain fetch, not authFetch) → confirm 순서로 처리.
 * 각 단계 실패 시 ErrorState 로 표시 (NFR-003 silent fail 금지).
 */
export function ImageUpload({ purpose, onUploaded, disabled }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // 클라이언트 검증 (SC-005): MIME 타입 + 파일 크기
    const allowedTypes: readonly string[] = ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.includes(file.type)) {
      setError(
        new Error(
          `허용되지 않는 파일 형식입니다. (허용: ${ALLOWED_IMAGE_TYPES.join(', ')})`,
        ),
      );
      resetInput();
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      const maxMb = MAX_IMAGE_BYTES / (1024 * 1024);
      setError(new Error(`파일 크기가 ${maxMb}MiB를 초과합니다.`));
      resetInput();
      return;
    }

    setUploading(true);
    try {
      // 1단계: presigned URL 발급
      const presign = await api.files.presign({ purpose, contentType: file.type });

      // 2단계: presigned URL로 PUT 업로드 (plain fetch — authFetch 아님)
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`이미지 업로드에 실패했습니다. (HTTP ${putRes.status})`);
      }

      // 3단계: 업로드 완료 확인
      await api.files.confirm(presign.id, file.size);

      onUploaded(presign.url);
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
      resetInput();
    }
  }

  function resetInput() {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={disabled || uploading}
        onChange={handleChange}
        className="text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      />
      {uploading && <LoadingState label="업로드 중…" />}
      {error !== null && !uploading && <ErrorState error={error} onRetry={() => setError(null)} />}
    </div>
  );
}
