/// 소셜 로그인 제공자로부터 획득한 토큰 자격증명.
class SocialCredential {
  final String provider;
  final String token;

  const SocialCredential({required this.provider, required this.token});
}

/// 소셜 SDK 연동 추상 인터페이스.
/// 실제 구현(KakaoSocialAuthService 등)은 각 플랫폼 SDK 패키지를 별도로 추가한 후 구현한다.
/// 테스트/개발 환경에서는 [StubSocialAuthService]를 사용한다.
///
/// Naver 는 이번 릴리즈에서 제외되었다(SEC-001/GAP-014-08/GAP-014-10 — 네이버 오픈API가
/// app/client 바인딩 검증 수단을 제공하지 않아 재로그인 경로의 계정 탈취를 차단할 수
/// 없음). 백엔드도 naver 를 지원 provider 목록에서 제외했으므로(SocialLoginDto), 이
/// 인터페이스에 signInWithNaver 를 추가하지 않는다.
abstract class SocialAuthService {
  Future<SocialCredential> signInWithKakao();
  Future<SocialCredential> signInWithGoogle();
}

/// 개발/테스트 환경 스텁 — 실제 SDK 없이 고정 토큰 반환.
class StubSocialAuthService implements SocialAuthService {
  @override
  Future<SocialCredential> signInWithKakao() async =>
      const SocialCredential(provider: 'kakao', token: 'stub-kakao-token');

  @override
  Future<SocialCredential> signInWithGoogle() async =>
      const SocialCredential(provider: 'google', token: 'stub-google-token');
}

/// 사용자가 소셜 로그인을 취소했을 때 던지는 예외.
/// 화면 레이어에서 무시(silent recovery)해야 한다.
class SocialAuthCancelled implements Exception {
  final String provider;
  const SocialAuthCancelled([this.provider = '']);

  @override
  String toString() => 'SocialAuthCancelled($provider)';
}
