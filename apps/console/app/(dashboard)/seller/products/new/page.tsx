'use client';

import type { CreateProductRequest } from '@doa/shared-types';
import { ApiError } from '@doa/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function NewProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSeller, sellerStatus } = useAuth();

  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.catalog.categories(),
  });

  const create = useMutation({
    mutationFn: (body: CreateProductRequest) => api.catalog.createProduct(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seller', 'products'] });
      router.replace('/seller/products');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : '상품 등록에 실패했습니다.');
    },
  });

  if (!isSeller) {
    return (
      <p className="text-sm text-zinc-500">판매자 등록 후 상품을 등록할 수 있습니다.</p>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const priceNum = Number(price);
    if (!categoryId) return setError('카테고리를 선택하세요.');
    if (!Number.isFinite(priceNum) || priceNum < 0) return setError('가격을 올바르게 입력하세요.');
    create.mutate({
      categoryId,
      title,
      description: description || undefined,
      price: priceNum,
    });
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">상품 등록</h1>
        <p className="mt-1 text-sm text-zinc-500">
          DRAFT 상태로 생성됩니다. 옵션·재고 등록 후 게시(publish)하세요.
        </p>
      </div>

      {sellerStatus !== 'APPROVED' && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          현재 승인 상태가 {sellerStatus} 입니다. 상품 생성은 APPROVED 판매자만 가능합니다.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
        <label className="block text-sm font-medium text-zinc-700">
          카테고리<span className="ml-0.5 text-red-500">*</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="">{categories.isLoading ? '불러오는 중…' : '선택'}</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          상품명<span className="ml-0.5 text-red-500">*</span>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          설명
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          기본 가격(원)<span className="ml-0.5 text-red-500">*</span>
          <input
            type="number"
            min={0}
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={create.isPending}
            className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {create.isPending ? '등록 중…' : '상품 등록'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 transition hover:bg-zinc-50"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
