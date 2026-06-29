'use client';

import type { Coupon, CouponType, CreateCouponRequest } from '@doa/shared-types';
import { ApiError } from '@doa/api-client';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorText,
  Input,
  Loading,
  PageHeader,
  Select,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '@doa/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatKRW } from '@/lib/order';

function discountLabel(c: Coupon): string {
  return c.type === 'FIXED' ? `${formatKRW(c.discountValue)} 할인` : `${c.discountValue}% 할인`;
}

/** 010 클라이언트 검증 — discountValue>0, PERCENTAGE 1~100, max/min 음수 금지. */
function validate(type: CouponType, discountValue: string): string | null {
  const v = Number(discountValue);
  if (!Number.isFinite(v) || v <= 0) return '할인값은 0보다 커야 합니다.';
  if (type === 'PERCENTAGE' && v > 100) return '비율 할인은 1~100 사이여야 합니다.';
  return null;
}

export default function SellerCouponsPage() {
  const { isSeller } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['seller', 'coupons'],
    queryFn: () => api.coupon.listSeller(),
    enabled: isSeller,
  });

  if (!isSeller) {
    return <EmptyState title="판매자 미등록" message="판매자 등록 후 쿠폰을 발급할 수 있습니다." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="쿠폰" subtitle="할인 쿠폰을 생성하고 고객에게 발급합니다." actions={<CreateCouponDialog />} />
      {isLoading && <Loading />}
      {error && <ErrorText>{error instanceof ApiError ? error.message : '불러오기 실패'}</ErrorText>}
      {data && data.items.length === 0 && (
        <EmptyState title="쿠폰 없음" message="‘쿠폰 생성’으로 첫 쿠폰을 만들어 보세요." />
      )}
      {data && data.items.length > 0 && (
        <Table>
          <THead>
            <TR>
              <TH>할인</TH>
              <TH>최소주문</TH>
              <TH className="text-right">발급/총량</TH>
              <TH>만료</TH>
              <TH className="text-right">발급</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{discountLabel(c)}</TD>
                <TD className="text-muted-foreground">
                  {c.minOrderAmount ? formatKRW(c.minOrderAmount) : '—'}
                </TD>
                <TD className="text-right tabular-nums">
                  {c.issuedCount}
                  {c.totalQuantity != null ? ` / ${c.totalQuantity}` : ''}
                </TD>
                <TD className="text-muted-foreground">
                  {new Date(c.expiresAt).toLocaleDateString('ko-KR')}
                </TD>
                <TD className="text-right">
                  <IssueCouponDialog coupon={c} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function CreateCouponDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CouponType>('FIXED');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const clientError = discountValue ? validate(type, discountValue) : null;

  const create = useMutation({
    mutationFn: () => {
      const body: CreateCouponRequest = {
        type,
        discountValue,
        expiresAt: new Date(expiresAt).toISOString(),
        ...(minOrderAmount ? { minOrderAmount } : {}),
        ...(totalQuantity ? { totalQuantity: Number(totalQuantity) } : {}),
      };
      return api.coupon.createSeller(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seller', 'coupons'] });
      setOpen(false);
      setDiscountValue('');
      setMinOrderAmount('');
      setExpiresAt('');
      setTotalQuantity('');
    },
  });

  const canSubmit = !!discountValue && !!expiresAt && !clientError && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">쿠폰 생성</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>쿠폰 생성</DialogTitle>
          <DialogDescription>할인 유형과 값을 입력하세요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select label="할인 유형" value={type} onChange={(e) => setType(e.target.value as CouponType)}>
            <option value="FIXED">정액(원)</option>
            <option value="PERCENTAGE">비율(%)</option>
          </Select>
          <Input
            label={type === 'FIXED' ? '할인 금액(원)' : '할인 비율(%)'}
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            required
          />
          <Input
            label="최소 주문 금액(선택)"
            type="number"
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
          />
          <Input
            label="발급 수량(선택)"
            type="number"
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(e.target.value)}
          />
          <Input
            label="만료일"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            required
          />
          {clientError && <ErrorText>{clientError}</ErrorText>}
          {create.error && (
            <ErrorText>{create.error instanceof ApiError ? create.error.message : '생성 실패'}</ErrorText>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!canSubmit}>
            {create.isPending ? '생성 중…' : '생성'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueCouponDialog({ coupon }: { coupon: Coupon }) {
  const [open, setOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const issue = useMutation({
    mutationFn: () => api.coupon.issueSeller(coupon.id, { targetUserId }),
    onSuccess: () => {
      setOpen(false);
      setTargetUserId('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          발급
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>쿠폰 발급</DialogTitle>
          <DialogDescription>
            <Badge tone="info">{discountLabel(coupon)}</Badge> 쿠폰을 사용자에게 발급합니다.
          </DialogDescription>
        </DialogHeader>
        <Input
          label="대상 사용자 ID"
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
          required
        />
        {issue.isSuccess && <p className="mt-2 text-sm text-success-foreground">발급 완료.</p>}
        {issue.error && (
          <ErrorText>{issue.error instanceof ApiError ? issue.error.message : '발급 실패'}</ErrorText>
        )}
        <DialogFooter>
          <Button onClick={() => issue.mutate()} disabled={!targetUserId || issue.isPending}>
            {issue.isPending ? '발급 중…' : '발급'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
