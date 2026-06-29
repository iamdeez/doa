'use client';

import { ApiError } from '@doa/api-client';
import {
  Badge,
  EmptyState,
  ErrorText,
  Loading,
  PageHeader,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@doa/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatKRW } from '@/lib/order';

const PERIOD = (a: string, b: string) =>
  `${new Date(a).toLocaleDateString('ko-KR')} ~ ${new Date(b).toLocaleDateString('ko-KR')}`;

/** GET /settlements — 판매자 본인 정산 내역. */
export default function SellerSettlementsPage() {
  const { isSeller } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['seller', 'settlements'],
    queryFn: () => api.settlement.listMine(),
    enabled: isSeller,
  });

  if (!isSeller) {
    return <EmptyState title="판매자 미등록" message="판매자 등록 후 정산 내역을 확인할 수 있습니다." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="정산" subtitle="구매 확정 매출 기준 정산 내역 (수수료 차감 후 지급액)." />
      {isLoading && <Loading />}
      {error && <ErrorText>{error instanceof ApiError ? error.message : '불러오기 실패'}</ErrorText>}
      {data && data.length === 0 && (
        <EmptyState title="정산 내역 없음" message="아직 생성된 정산이 없어요." />
      )}
      {data && data.length > 0 && (
        <Table>
          <THead>
            <TR>
              <TH>정산 기간</TH>
              <TH className="text-right">총 매출</TH>
              <TH className="text-right">수수료</TH>
              <TH className="text-right">지급액</TH>
              <TH>상태</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((s) => (
              <TR key={s.id}>
                <TD className="text-muted-foreground">{PERIOD(s.periodStart, s.periodEnd)}</TD>
                <TD className="text-right tabular-nums">{formatKRW(s.totalSales)}</TD>
                <TD className="text-right tabular-nums text-muted-foreground">
                  −{formatKRW(s.commission)}
                </TD>
                <TD className="text-right font-semibold tabular-nums">{formatKRW(s.payoutAmount)}</TD>
                <TD>
                  <Badge tone={s.status === 'completed' ? 'success' : 'warning'}>
                    {s.status === 'completed' ? '지급완료' : '정산대기'}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
