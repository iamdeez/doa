import { redirect } from 'next/navigation';

/** 루트 진입 → 대시보드로. 미인증이면 대시보드 레이아웃 가드가 /login 으로 보낸다. */
export default function Home() {
  redirect('/dashboard');
}
