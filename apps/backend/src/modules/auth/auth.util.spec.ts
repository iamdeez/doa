/**
 * auth.util 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-024 (FR-016, NFR-004 관련)
 * 검증 방법: Jest — maskEmail 순수 함수 직접 호출
 *
 * SC-024: 이메일 찾기 결과 이메일이 앞 2자 공개 + @ 앞 나머지 마스킹(**) + @ + 도메인
 *   형태로 표시된다.
 *
 * NFR-004: 앞 2자를 제외한 @ 앞 부분을 마스킹(**) 처리, 도메인 부분 그대로.
 * plan §A-3: maskEmail('johndoe@example.com') → 'jo**@example.com'
 *             maskEmail('ab@x.com') → 'ab**@x.com'
 *             maskEmail('a@x.com')  → 'a**@x.com'
 */

import { maskEmail } from './auth.util';

describe('maskEmail (SC-024 — FR-016, NFR-004)', () => {
  // ─────────────────────────────────────────────
  // Happy Path: local ≥ 3자 (일반 케이스)
  // ─────────────────────────────────────────────
  describe('test_mask_email_format — local 3자 이상', () => {
    it('when_local_longer_than_2_then_first2_plus_mask_at_domain', () => {
      /**
       * SC-024 Happy Path:
       * local 파트가 3자 이상인 경우 앞 2자 + '**' + '@' + 도메인 형태 반환.
       * 예: 'johndoe@example.com' → 'jo**@example.com'
       */
      expect(maskEmail('johndoe@example.com')).toBe('jo**@example.com');
    });

    it('when_local_exactly_3_then_first2_plus_mask', () => {
      /**
       * SC-024 Happy Path (local=3):
       * 'abc@x.com' → 'ab**@x.com'
       */
      expect(maskEmail('abc@x.com')).toBe('ab**@x.com');
    });
  });

  // ─────────────────────────────────────────────
  // Edge Case: local ≤ 2자 경계
  // ─────────────────────────────────────────────
  describe('test_mask_email_short_local — local ≤ 2자 경계', () => {
    it('when_local_exactly_2_then_keep2_plus_mask', () => {
      /**
       * SC-024 Edge Case (local=2):
       * plan §A-3: 'ab@x.com' → 'ab**@x.com'
       * keep = local.slice(0, min(2, 2)) = 'ab' → 'ab**@x.com'
       */
      expect(maskEmail('ab@x.com')).toBe('ab**@x.com');
    });

    it('when_local_exactly_1_then_keep1_plus_mask', () => {
      /**
       * SC-024 Edge Case (local=1):
       * plan §A-3: 'a@x.com' → 'a**@x.com'
       * keep = local.slice(0, min(2, 1)) = 'a' → 'a**@x.com'
       */
      expect(maskEmail('a@x.com')).toBe('a**@x.com');
    });
  });

  // ─────────────────────────────────────────────
  // Edge Case: 도메인 다양성
  // ─────────────────────────────────────────────
  describe('domain 다양성 — 도메인 부분 그대로 표시', () => {
    it('when_domain_has_multiple_dots_then_domain_preserved', () => {
      /**
       * SC-024 보조: 도메인 부분은 변환 없이 그대로.
       * 'johndoe@mail.example.co.kr' → 'jo**@mail.example.co.kr'
       */
      expect(maskEmail('johndoe@mail.example.co.kr')).toBe('jo**@mail.example.co.kr');
    });
  });
});
