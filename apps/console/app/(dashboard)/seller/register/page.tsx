'use client';

import type { SellerRegisterRequest } from '@doa/shared-types';
import { ApiError } from '@doa/api-client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const FIELDS: {
  key: keyof SellerRegisterRequest;
  label: string;
  required: boolean;
  placeholder?: string;
}[] = [
  { key: 'businessName', label: '상호 / 브랜드명', required: true },
  { key: 'businessNumber', label: '사업자등록번호', required: true, placeholder: '000-00-00000' },
  { key: 'representativeName', label: '대표자명', required: true },
  { key: 'contactPhone', label: '연락처', required: false, placeholder: '010-0000-0000' },
  { key: 'businessAddress', label: '사업장 주소', required: false },
];

export default function SellerRegisterPage() {
  const router = useRouter();
  const { isSeller, sellerStatus, refresh } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isSeller) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8">
        <h1 className="text-xl font-semibold text-zinc-900">이미 판매자로 등록됨</h1>
        <p className="mt-2 text-sm text-zinc-500">현재 승인 상태: {sellerStatus}</p>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: SellerRegisterRequest = {
        businessName: form.businessName ?? '',
        businessNumber: form.businessNumber ?? '',
        representativeName: form.representativeName ?? '',
        contactPhone: form.contactPhone || undefined,
        businessAddress: form.businessAddress || undefined,
      };
      await api.seller.register(body);
      await refresh();
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '판매자 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">판매자 등록</h1>
        <p className="mt-1 text-sm text-zinc-500">
          등록 후 관리자 승인(APPROVED)을 받으면 상품을 등록할 수 있습니다.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm font-medium text-zinc-700">
            {f.label}
            {f.required && <span className="ml-0.5 text-red-500">*</span>}
            <input
              type="text"
              required={f.required}
              value={form[f.key] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </label>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? '등록 중…' : '판매자 등록 신청'}
        </button>
      </form>
    </div>
  );
}
