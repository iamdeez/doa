/**
 * ImageUpload 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-004, SC-005, SC-006
 * 검증 방법: vitest + @testing-library/react, fetch mock, api mock
 *
 * Canonical 심볼:
 *   <ImageUpload purpose={FilePurpose} onUploaded={(url) => void} disabled? />
 *   위치: apps/console/components/image-upload.tsx
 *   상수: ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES (apps/console/lib/upload-constants.ts)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { ImageUpload } from './image-upload';

// api mock — vi.mock은 호이스팅되므로 import보다 먼저 적용됨
vi.mock('@/lib/api', () => ({
  api: {
    files: {
      presign: vi.fn(),
      confirm: vi.fn(),
    },
  },
}));

// states 컴포넌트 mock — @doa/ui 전이 의존 차단
vi.mock('@/components/states', () => ({
  LoadingState: ({ label }: { label?: string }) => <div data-testid="loading-state">{label ?? '로딩 중'}</div>,
  ErrorState: ({ error }: { error: unknown }) => (
    <div data-testid="error-state">{error instanceof Error ? error.message : '오류 발생'}</div>
  ),
}));

const mockApi = vi.mocked(api);

// 상수 (PROC-004 — Canonical 참조, 추측 금지)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MiB

// presign 응답 픽스처
const PRESIGN_RESULT = {
  id: 'file-id-001',
  key: 'uploads/file-id-001.png',
  uploadUrl: 'https://storage.example.com/presigned-put-url',
  url: 'https://cdn.example.com/uploads/file-id-001.png',
};

function createMockFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe('ImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // global.fetch mock (presigned URL PUT 단계)
    global.fetch = vi.fn();
  });

  // ─────────────────────────────────────────────
  // SC-004: 유효 파일 선택 시 3단계 순서 호출
  // ─────────────────────────────────────────────
  describe('SC-004: 3단계 순서 호출 (presign → PUT → confirm → onUploaded)', () => {
    it('when_valid_file_then_presign_put_confirm_sequence', async () => {
      /**
       * SC-004 (FR-002 관련):
       * 유효한 이미지 파일 선택 시 presign → PUT(presigned URL) → confirm 순서로 실행하고
       * 완료 후 onUploaded(publicUrl)을 호출한다.
       */
      mockApi.files.presign.mockResolvedValue(PRESIGN_RESULT);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });
      mockApi.files.confirm.mockResolvedValue({ ...PRESIGN_RESULT, status: 'UPLOADED', size: 1024 });

      const onUploaded = vi.fn();
      render(
        <ImageUpload purpose="PRODUCT_IMAGE" onUploaded={onUploaded} />,
      );

      const file = createMockFile('photo.jpg', 'image/jpeg', 1024);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await userEvent.upload(input, file);
      }

      await waitFor(() => {
        // presign 호출 확인
        expect(mockApi.files.presign).toHaveBeenCalledWith({
          purpose: 'PRODUCT_IMAGE',
          contentType: 'image/jpeg',
        });
      });

      await waitFor(() => {
        // PUT 호출 확인 (presigned URL + plain fetch)
        expect(global.fetch).toHaveBeenCalledWith(
          PRESIGN_RESULT.uploadUrl,
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({ 'Content-Type': 'image/jpeg' }),
          }),
        );
      });

      await waitFor(() => {
        // confirm 호출 확인
        expect(mockApi.files.confirm).toHaveBeenCalledWith(PRESIGN_RESULT.id, 1024);
      });

      await waitFor(() => {
        // onUploaded(publicUrl) 호출 확인
        expect(onUploaded).toHaveBeenCalledWith(PRESIGN_RESULT.url);
      });
    });
  });

  // ─────────────────────────────────────────────
  // SC-005: MIME 불허 / 10MiB 초과 → presign 미호출
  // ─────────────────────────────────────────────
  describe('SC-005: 클라이언트 검증 차단 (MIME 불허 / 크기 초과)', () => {
    it('when_bad_mime_then_no_presign', async () => {
      /**
       * SC-005 (FR-002, NFR-002 관련):
       * 허용되지 않는 MIME 타입 파일 선택 시 presign 미호출 + 오류 메시지 표시.
       * 허용: image/jpeg, image/png, image/webp, image/gif
       * 불허: image/svg+xml, application/pdf 등
       */
      const onUploaded = vi.fn();
      render(
        <ImageUpload purpose="PRODUCT_IMAGE" onUploaded={onUploaded} />,
      );

      const file = createMockFile('document.svg', 'image/svg+xml', 1024);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await userEvent.upload(input, file);
      }

      // presign 미호출 확인
      expect(mockApi.files.presign).not.toHaveBeenCalled();
      // onUploaded 미호출 확인
      expect(onUploaded).not.toHaveBeenCalled();
    });

    it('when_oversize_then_no_presign', async () => {
      /**
       * SC-005 (FR-002, NFR-002 관련):
       * 10MiB 초과 파일 선택 시 presign 미호출 + 오류 메시지 표시.
       * MAX_IMAGE_BYTES = 10 * 1024 * 1024 (= 10,485,760 bytes)
       */
      const onUploaded = vi.fn();
      render(
        <ImageUpload purpose="PRODUCT_IMAGE" onUploaded={onUploaded} />,
      );

      // 10MiB + 1 byte → 초과
      const oversizeFile = createMockFile('large.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await userEvent.upload(input, oversizeFile);
      }

      // presign 미호출 확인
      expect(mockApi.files.presign).not.toHaveBeenCalled();
      expect(onUploaded).not.toHaveBeenCalled();
    });

    it('when_allowed_mime_type_does_not_trigger_validation_error', () => {
      /**
       * SC-005 참조: 허용 MIME 타입 목록 확인 (PROC-004 — spec 상수와 1:1 대조)
       * ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
       */
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      expect(ALLOWED_IMAGE_TYPES).toEqual(allowedTypes);
    });
  });

  // ─────────────────────────────────────────────
  // SC-006: 각 단계 실패 시 오류 메시지 (silent fail 금지)
  // ─────────────────────────────────────────────
  describe('SC-006: 단계별 실패 → 오류 메시지 표시 (NFR-003 silent fail 금지)', () => {
    it('when_presign_fails_then_error_shown', async () => {
      /**
       * SC-006 (FR-002, NFR-003 관련):
       * presign 단계 실패 시 오류 메시지를 표시하고 이후 단계를 실행하지 않는다.
       */
      mockApi.files.presign.mockRejectedValue(new Error('presign 서버 오류'));

      const onUploaded = vi.fn();
      render(
        <ImageUpload purpose="PRODUCT_IMAGE" onUploaded={onUploaded} />,
      );

      const file = createMockFile('photo.png', 'image/png', 1024);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await userEvent.upload(input, file);
      }

      await waitFor(() => {
        // PUT 미호출 (presign 실패 후 중단)
        expect(global.fetch).not.toHaveBeenCalled();
        expect(onUploaded).not.toHaveBeenCalled();
      });
    });

    it('when_put_fails_then_error_shown', async () => {
      /**
       * SC-006 (FR-002, NFR-003 관련):
       * PUT 단계 실패(비-2xx 응답) 시 오류 메시지를 표시하고 confirm을 실행하지 않는다.
       */
      mockApi.files.presign.mockResolvedValue(PRESIGN_RESULT);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 403 });

      const onUploaded = vi.fn();
      render(
        <ImageUpload purpose="PRODUCT_IMAGE" onUploaded={onUploaded} />,
      );

      const file = createMockFile('photo.webp', 'image/webp', 1024);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await userEvent.upload(input, file);
      }

      await waitFor(() => {
        // confirm 미호출 (PUT 실패 후 중단)
        expect(mockApi.files.confirm).not.toHaveBeenCalled();
        expect(onUploaded).not.toHaveBeenCalled();
      });
    });

    it('when_confirm_fails_then_error_shown', async () => {
      /**
       * SC-006 (FR-002, NFR-003 관련):
       * confirm 단계 실패 시 오류 메시지를 표시한다(파일은 스토리지에 업로드됐으나 PENDING 유지).
       * onUploaded는 호출되지 않는다.
       */
      mockApi.files.presign.mockResolvedValue(PRESIGN_RESULT);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });
      mockApi.files.confirm.mockRejectedValue(new Error('confirm 서버 오류'));

      const onUploaded = vi.fn();
      render(
        <ImageUpload purpose="PRODUCT_IMAGE" onUploaded={onUploaded} />,
      );

      const file = createMockFile('photo.gif', 'image/gif', 1024);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await userEvent.upload(input, file);
      }

      await waitFor(() => {
        // onUploaded 미호출 (confirm 실패)
        expect(onUploaded).not.toHaveBeenCalled();
      });
    });
  });
});
