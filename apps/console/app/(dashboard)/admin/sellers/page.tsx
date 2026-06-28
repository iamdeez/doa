'use client';

/**
 * 판매자 승인(관리자) 화면 — 스캐폴딩.
 *
 * 백엔드는 PATCH /sellers/:id/approve|reject 만 노출하며, "판매자 목록 조회(관리자)"
 * 엔드포인트와 "내가 관리자인가" 판별 엔드포인트가 아직 없다(문서화된 갭).
 * 승인/반려 액션은 백엔드 AdminGuard(ADMIN_USER_IDS)가 최종 강제하므로,
 * 비관리자가 호출하면 403 으로 거부된다. 목록 API 추가 시 이 화면을 실데이터로 채운다.
 */
export default function AdminSellersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">판매자 승인</h1>
        <p className="mt-1 text-sm text-zinc-500">관리자 전용 · 승인 대기 판매자 관리</p>
      </div>

      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
        <div className="text-sm font-medium text-zinc-700">목록 API 대기 중</div>
        <div className="mt-1 text-sm text-zinc-400">
          관리자용 판매자 목록 조회 엔드포인트가 백엔드에 추가되면 여기에 승인/반려 큐가 표시됩니다.
        </div>
      </div>
    </div>
  );
}
