'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function DashboardPage() {
  const { profile, isSeller, sellerStatus } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">대시보드</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {profile?.email} 님, 환영합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="계정" value={profile?.email ?? '-'} />
        <Card title="판매자 상태" value={isSeller ? (sellerStatus ?? '-') : '미등록'} />
        <Card title="역할" value={isSeller ? '판매자' : '일반'} />
      </div>

      {!isSeller && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5">
          <div>
            <div className="text-sm font-medium text-zinc-900">판매자로 등록하기</div>
            <div className="mt-0.5 text-sm text-zinc-400">
              판매자 등록 후 관리자 승인을 받으면 상품을 판매할 수 있습니다.
            </div>
          </div>
          <Link
            href="/seller/register"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            판매자 등록
          </Link>
        </div>
      )}

      <p className="text-sm text-zinc-400">
        ※ 이 콘솔은 스캐폴딩 단계입니다. 상품·주문·정산 화면은 백엔드 도메인 구현에 맞춰 단계적으로 추가됩니다.
      </p>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">{title}</div>
      <div className="mt-2 truncate text-lg font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
