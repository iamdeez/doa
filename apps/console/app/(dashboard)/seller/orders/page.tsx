'use client';

import type { OrderStatus, SellerOrder } from '@doa/shared-types';
import { ApiError } from '@doa/api-client';
import {
  Badge,
  Button,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatKRW, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/order';

/** GET /seller/orders — 판매자 주문·배송 관리. */
export default function SellerOrdersPage() {
  const { isSeller } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller', 'orders'],
    queryFn: () => api.order.listSeller(),
    enabled: isSeller,
  });

  const confirm = useMutation({
    mutationFn: (orderId: string) => api.order.confirm(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller', 'orders'] }),
  });

  if (!isSeller) {
    return (
      <EmptyState
        title="판매자 미등록"
        message="판매자로 등록되어 있지 않습니다. 판매자 등록 후 주문을 관리할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="주문·배송" subtitle="결제 완료 주문을 확인하고 송장을 등록합니다." />

      {isLoading && <Loading />}
      {error && <ErrorText>{error instanceof ApiError ? error.message : '불러오기 실패'}</ErrorText>}

      {data && data.length === 0 && (
        <EmptyState title="주문이 없습니다" message="아직 들어온 주문이 없어요." />
      )}

      {data && data.length > 0 && (
        <Table>
          <THead>
            <TR>
              <TH>주문</TH>
              <TH>상태</TH>
              <TH className="text-right">결제금액</TH>
              <TH>주문일</TH>
              <TH className="text-right">조치</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((order) => (
              <TR key={order.id}>
                <TD className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 12)}…</TD>
                <TD>
                  <Badge tone={ORDER_STATUS_TONE[order.status]}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </Badge>
                </TD>
                <TD className="text-right font-medium tabular-nums">{formatKRW(order.totalAmount)}</TD>
                <TD className="text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                </TD>
                <TD className="text-right">
                  <OrderAction
                    order={order}
                    onConfirm={() => confirm.mutate(order.id)}
                    confirming={confirm.isPending && confirm.variables === order.id}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {confirm.error && (
        <ErrorText>
          {confirm.error instanceof ApiError ? confirm.error.message : '주문 확인 실패'}
        </ErrorText>
      )}
    </div>
  );
}

function OrderAction({
  order,
  onConfirm,
  confirming,
}: {
  order: SellerOrder;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const shipHref = `/seller/orders/${order.id}/ship`;
  switch (order.status as OrderStatus) {
    case 'confirmed':
      return (
        <Button size="sm" onClick={onConfirm} disabled={confirming}>
          {confirming ? '처리 중…' : '주문 확인'}
        </Button>
      );
    case 'preparing':
      return (
        <Button size="sm" variant="secondary" asChild>
          <Link href={shipHref}>송장 등록</Link>
        </Button>
      );
    case 'shipped':
    case 'delivered':
      return (
        <Button size="sm" variant="ghost" asChild>
          <Link href={shipHref}>배송 관리</Link>
        </Button>
      );
    default:
      return <span className="text-xs text-subtle-foreground">—</span>;
  }
}
