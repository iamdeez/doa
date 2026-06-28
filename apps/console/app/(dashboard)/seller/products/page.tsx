'use client';

import type { Product } from '@doa/shared-types';
import { ApiError } from '@doa/api-client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const STATUS_STYLE: Record<Product['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT: 'bg-zinc-100 text-zinc-600',
  OUT_OF_STOCK: 'bg-amber-100 text-amber-700',
  INACTIVE: 'bg-zinc-100 text-zinc-400',
};

/** GET /sellers/me/products — 실제 백엔드 통합 데모 화면. */
export default function SellerProductsPage() {
  const { isSeller, sellerStatus } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller', 'products'],
    queryFn: () => api.seller.myProducts(),
    enabled: isSeller,
  });

  if (!isSeller) {
    return (
      <EmptyState
        title="판매자 미등록"
        message="판매자로 등록되어 있지 않습니다. 판매자 등록 후 상품을 관리할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">내 상품</h1>
          <p className="mt-1 text-sm text-zinc-500">승인 상태: {sellerStatus}</p>
        </div>
        <Link
          href="/seller/products/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          상품 등록
        </Link>
      </div>

      {isLoading && <p className="text-sm text-zinc-500">불러오는 중…</p>}

      {error && (
        <p className="text-sm text-red-600">
          {error instanceof ApiError ? error.message : '상품을 불러오지 못했습니다.'}
        </p>
      )}

      {data && data.length === 0 && (
        <EmptyState title="등록된 상품 없음" message="아직 등록한 상품이 없습니다." />
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">상품명</th>
                <th className="px-4 py-3 font-medium">기본가</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <Link href={`/seller/products/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{p.price}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/seller/products/${p.id}`}
                      className="text-sm text-zinc-500 hover:text-zinc-900"
                    >
                      관리 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
      <div className="text-sm font-medium text-zinc-700">{title}</div>
      <div className="mt-1 text-sm text-zinc-400">{message}</div>
    </div>
  );
}
