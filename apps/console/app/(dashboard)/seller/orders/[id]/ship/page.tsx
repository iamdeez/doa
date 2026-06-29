'use client';

import type { Shipment, ShipmentStatus } from '@doa/shared-types';
import { ApiError } from '@doa/api-client';
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Loading,
  PageHeader,
} from '@doa/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SHIPMENT_STATUS_LABEL } from '@/lib/order';

/** 송장 등록 + 배송 상태 관리 — POST /shipments, PATCH /shipments/:id/status, GET tracking. */
export default function ShipPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const { isSeller } = useAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const create = useMutation({
    mutationFn: () => api.shipping.create({ orderId, carrier, trackingNumber }),
    onSuccess: (s) => setShipment(s),
  });

  const updateStatus = useMutation({
    mutationFn: (status: ShipmentStatus) =>
      api.shipping.updateStatus(shipment!.id, { status }),
    onSuccess: (s) => setShipment(s),
  });

  const tracking = useQuery({
    queryKey: ['shipment', shipment?.id, 'tracking'],
    queryFn: () => api.shipping.tracking(shipment!.id),
    enabled: !!shipment,
  });

  if (!isSeller) {
    return <ErrorText>판매자 전용 화면입니다.</ErrorText>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="송장 등록 · 배송"
        subtitle={
          <>
            주문 <span className="font-mono text-xs">{orderId.slice(0, 12)}…</span>
          </>
        }
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/seller/orders">← 목록</Link>
          </Button>
        }
      />

      {!shipment ? (
        <Card className="max-w-md space-y-4">
          <div className="text-sm font-medium text-foreground">송장 정보</div>
          <Input
            label="택배사"
            placeholder="예: CJ대한통운"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            required
          />
          <Input
            label="운송장 번호"
            placeholder="예: 1234567890"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            required
          />
          <Button
            fullWidth
            onClick={() => create.mutate()}
            disabled={create.isPending || !carrier || !trackingNumber}
          >
            {create.isPending ? '등록 중…' : '송장 등록 (발송 처리)'}
          </Button>
          {create.error && (
            <ErrorText>
              {create.error instanceof ApiError ? create.error.message : '송장 등록 실패'}
            </ErrorText>
          )}
          <p className="text-xs text-subtle-foreground">
            송장을 등록하면 주문이 <b>배송중</b>으로 전이됩니다. 이미 발송된 주문은 등록할 수 없습니다.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-foreground">배송 상태</div>
              <Badge tone={shipment.status === 'delivered' ? 'success' : 'info'}>
                {SHIPMENT_STATUS_LABEL[shipment.status]}
              </Badge>
            </div>
            <dl className="space-y-1 text-sm">
              <Row label="택배사" value={shipment.carrier} />
              <Row label="운송장" value={shipment.trackingNumber} />
            </dl>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => updateStatus.mutate('in_transit')}
                disabled={updateStatus.isPending || shipment.status === 'delivered'}
              >
                배송중 처리
              </Button>
              <Button
                size="sm"
                onClick={() => updateStatus.mutate('delivered')}
                disabled={updateStatus.isPending || shipment.status === 'delivered'}
              >
                배송완료 처리
              </Button>
            </div>
            {updateStatus.error && (
              <ErrorText>
                {updateStatus.error instanceof ApiError ? updateStatus.error.message : '상태 변경 실패'}
              </ErrorText>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-medium text-foreground">추적 이력</div>
            {tracking.isLoading && <Loading />}
            {tracking.data && tracking.data.length === 0 && (
              <p className="text-sm text-muted-foreground">이력이 없습니다.</p>
            )}
            <ol className="space-y-3">
              {tracking.data?.map((t) => (
                <li key={t.id} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-pill bg-accent" />
                  <div>
                    <div className="font-medium text-foreground">
                      {SHIPMENT_STATUS_LABEL[t.status]}
                    </div>
                    <div className="text-muted-foreground">{t.description}</div>
                    <div className="text-xs text-subtle-foreground">
                      {new Date(t.occurredAt).toLocaleString('ko-KR')}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
