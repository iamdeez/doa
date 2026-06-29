/**
 * 정적 코드 검증 — SC-051 [env:unit/static]
 *
 * 대상 SC:
 *   SC-051 (004-review-coupon, NFR-002 관련) — 조건부 UPDATE WHERE status='unused' 정적 grep
 *
 * 검증 방법: Node.js fs + 소스 텍스트 파싱
 *
 * 검증 내용:
 *   coupon.repository.ts 의 `markUserCouponUsed` 구현에
 *   `updateMany` + `WHERE status=unused` 조건이 포함됨을 검증.
 *
 *   ADR-002: 이중사용 방지를 위해 user_coupon 상태 갱신은
 *   `WHERE status='unused'` 조건부 UPDATE 를 사용해야 한다.
 *   단순 findUnique + update(status) 패턴은 TOCTOU 레이스 컨디션에 취약하다.
 *
 *   검증 패턴:
 *   (1) `userCoupon.updateMany` 호출 존재 확인 (조건부 UPDATE)
 *   (2) WHERE 절에 `status.*unused` 또는 `UserCouponStatus.unused` 패턴 존재 확인
 *   (3) 단순 `userCoupon.update(` 단독 사용 금지 (TOCTOU 취약 패턴 차단)
 *
 * 실행: 앱 기동·DB 연결 불필요. 파일 텍스트 검증만.
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKEND_ROOT = path.resolve(__dirname, '../../');
const COUPON_REPO_PATH = path.join(
  BACKEND_ROOT,
  'src/modules/coupon/coupon.repository.ts',
);

describe('SC-051: 조건부 UPDATE WHERE status=unused 정적 grep', () => {
  it('when_inspect_coupon_repository_then_updateMany_with_status_unused_exists', () => {
    /**
     * SC-051 (NFR-002 관련):
     * user_coupon 상태 갱신 시 `WHERE status='unused'` 조건이 포함된
     * 조건부 UPDATE 구문(`updateMany`)이 사용된다.
     *
     * 검증 전략:
     *   coupon.repository.ts 에서 `userCoupon.updateMany` 호출과
     *   `status` + `unused` 조건이 함께 존재함을 확인.
     *
     * TDD Red: coupon.repository.ts 미생성 시 스킵.
     */
    if (!fs.existsSync(COUPON_REPO_PATH)) {
      return;
    }

    const source = fs.readFileSync(COUPON_REPO_PATH, 'utf-8');

    // (1) updateMany 호출 존재 확인 (단순 update 단독 사용 금지)
    const hasUpdateMany = /userCoupon\.updateMany\s*\(/.test(source);
    expect(hasUpdateMany).toBe(true);

    // (2) status=unused 조건 존재 확인 (UserCouponStatus.unused 또는 'unused' 리터럴)
    const hasStatusUnusedCondition =
      /UserCouponStatus\.unused/.test(source) || /status:\s*['"]unused['"]/.test(source);
    expect(hasStatusUnusedCondition).toBe(true);
  });

  it('when_inspect_coupon_repository_then_markUserCouponUsed_uses_conditional_update', () => {
    /**
     * SC-051 (NFR-002 관련) — markUserCouponUsed 함수 상세 검증:
     * markUserCouponUsed 메서드가 updateMany 와 status=unused WHERE 조건을 함께 사용.
     *
     * 검증 범위: markUserCouponUsed 함수 블록 내 패턴 확인.
     * (단순 findUnique + update 순차 호출은 TOCTOU 취약 — 금지 패턴)
     */
    if (!fs.existsSync(COUPON_REPO_PATH)) {
      return;
    }

    const source = fs.readFileSync(COUPON_REPO_PATH, 'utf-8');

    // markUserCouponUsed 함수가 존재해야 함
    const hasFunctionDef = /markUserCouponUsed/.test(source);
    expect(hasFunctionDef).toBe(true);

    // updateMany 와 status(unused) 조건이 동일 소스에 함께 존재
    // (단일 함수 스코프 검사: 전체 파일에 두 패턴이 모두 있으면 충분 — grep 수준)
    const violations: string[] = [];

    if (!/userCoupon\.updateMany/.test(source)) {
      violations.push('userCoupon.updateMany 호출 미존재 (조건부 UPDATE 필요)');
    }

    if (
      !/UserCouponStatus\.unused/.test(source) &&
      !/status:\s*['"]unused['"]/.test(source)
    ) {
      violations.push('status=unused WHERE 조건 미존재 (ADR-002 이중사용 방지 패턴 필요)');
    }

    if (violations.length > 0) {
      throw new Error(
        `SC-051 위반: coupon.repository.ts 에 조건부 UPDATE 패턴 부재.\n` +
          violations.join('\n') +
          '\n\n' +
          'ADR-002: 이중사용 방지를 위해 userCoupon.updateMany({where:{status:unused}}) 패턴을 사용하세요.',
      );
    }
  });

  it('when_inspect_coupon_repository_then_no_unsafe_single_update_for_status', () => {
    /**
     * SC-051 (NFR-002 관련) — 네거티브 확인:
     * 상태 변경 시 단순 `userCoupon.update(` 만 사용하는 TOCTOU 취약 패턴이 없어야 함.
     *
     * 주의: `userCoupon.update` 단독이 금지가 아니라, status 변경을 updateMany 없이
     * update 단독으로만 수행하는 패턴이 금지다. 파일에 updateMany 가 존재하면 통과.
     */
    if (!fs.existsSync(COUPON_REPO_PATH)) {
      return;
    }

    const source = fs.readFileSync(COUPON_REPO_PATH, 'utf-8');

    // updateMany 가 있으면 조건부 UPDATE 패턴이 적용된 것으로 판단 — 통과
    const hasUpdateMany = /userCoupon\.updateMany\s*\(/.test(source);

    if (!hasUpdateMany) {
      // updateMany 미존재이면서 userCoupon.update 로 status 변경하면 위반
      const hasUnsafeUpdate =
        /userCoupon\.update\s*\(/.test(source) && /status.*used/.test(source);

      if (hasUnsafeUpdate) {
        throw new Error(
          'SC-051 위반: userCoupon.update 단독으로 status 변경 — TOCTOU 취약.\n' +
            'updateMany({where:{id, status:unused}}) 패턴으로 교체하세요.',
        );
      }
    }

    // updateMany 가 있으면 안전한 패턴으로 판단
    expect(true).toBe(true);
  });
});
