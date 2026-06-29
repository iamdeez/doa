'use client';

import { ApiError } from '@doa/api-client';
import { EmptyState, ErrorText, Loading, PageHeader, StatCard } from '@doa/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatKRW } from '@/lib/order';

/** GET /seller/stats — 판매자 매출·주문 요약. */
export default function SellerStatsPage() {
  const { isSeller } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['seller', 'stats'],
    queryFn: () => api.stats.seller(),
    enabled: isSeller,
  });

  if (!isSeller) {
    return <EmptyState title="판매자 미등록" message="판매자 등록 후 통계를 확인할 수 있습니다." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="판매 통계" subtitle="구매 확정(completed) 기준 누적 요약입니다." />
      {isLoading && <Loading />}
      {error && <ErrorText>{error instanceof ApiError ? error.message : '불러오기 실패'}</ErrorText>}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="누적 매출" value={formatKRW(data.salesTotal)} />
          <StatCard title="완료 주문 수" value={`${data.orderCount.toLocaleString('ko-KR')}건`} />
        </div>
      )}
    </div>
  );
}
