/**
 * 콘솔 전용 상태 컴포넌트.
 * @doa/ui 의 피드백 primitives(Loading, ErrorText, EmptyState)를 래핑하여
 * 콘솔 내에서 일관된 로딩/에러/빈 화면을 제공한다.
 *
 * 동명 EmptyState(@doa/ui) 와 구분하려면 `@/components/states` 경로로 import.
 */
import type { ReactNode } from 'react';
import { Loading, ErrorText, EmptyState as UiEmptyState } from '@doa/ui';
import { ApiError } from '@doa/api-client';

export function LoadingState({ label }: { label?: string }) {
  return <Loading label={label} />;
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof ApiError
      ? error.status === 403
        ? '접근 권한이 없습니다.'
        : error.message
      : error instanceof Error
        ? error.message
        : '오류가 발생했습니다.';

  return (
    <div className="flex flex-col items-start gap-2">
      <ErrorText>{message}</ErrorText>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-sm text-primary underline">
          다시 시도
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <UiEmptyState title={title} message={message} />
      {action}
    </div>
  );
}
