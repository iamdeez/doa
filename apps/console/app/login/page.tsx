'use client';

import { ApiError } from '@doa/api-client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace('/dashboard');
  }, [loading, isAuthenticated, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? '이메일 또는 비밀번호가 올바르지 않습니다.' : err.message);
      } else {
        setError('로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-zinc-900">DOA Console</h1>
        <p className="mt-1 text-sm text-zinc-500">판매자·관리자 로그인</p>

        <label className="mt-6 block text-sm font-medium text-zinc-700">
          이메일
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            placeholder="you@example.com"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-zinc-700">
          비밀번호
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </main>
  );
}
