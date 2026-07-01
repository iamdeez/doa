import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';
import 'token_store.dart';

final secureStorageProvider = Provider((_) => const FlutterSecureStorage());
final tokenStoreProvider = Provider((ref) => TokenStore(ref.read(secureStorageProvider)));
final apiClientProvider = Provider((ref) => ApiClient(ref.read(tokenStoreProvider)));
final dioProvider = Provider<Dio>((ref) => ref.read(apiClientProvider).dio);

enum AuthStatus { unknown, authenticated, unauthenticated }

/// 인증 상태 — 앱 시작 시 토큰 존재로 판정, 로그인/로그아웃 시 전이.
class AuthController extends Notifier<AuthStatus> {
  @override
  AuthStatus build() {
    _restore();
    return AuthStatus.unknown;
  }

  TokenStore get _tokens => ref.read(tokenStoreProvider);
  Dio get _dio => ref.read(dioProvider);

  Future<void> _restore() async {
    final token = await _tokens.accessToken;
    state = token == null ? AuthStatus.unauthenticated : AuthStatus.authenticated;
  }

  Future<void> login(String email, String password) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
      options: Options(extra: {'anonymous': true}),
    );
    await _tokens.save(
      accessToken: res.data!['accessToken'] as String,
      refreshToken: res.data!['refreshToken'] as String,
    );
    state = AuthStatus.authenticated;
  }

  Future<void> logout() async {
    await _tokens.clear();
    state = AuthStatus.unauthenticated;
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthStatus>(AuthController.new);

/// GET /auth/me — 인증된 사용자 기본 정보 (id·email·name·isAdmin)
final authMeProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final dio = ref.read(dioProvider);
  final res = await dio.get<Map<String, dynamic>>('/auth/me');
  return res.data ?? {};
});

/// GET /users/me — 사용자 프로필 상세 (name·phone 등)
final userProfileProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final dio = ref.read(dioProvider);
  final res = await dio.get<Map<String, dynamic>>('/users/me');
  return res.data ?? {};
});

/// 정적 FAQ 목록 — 사전 정의 (FR-006)
final faqProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return const [
    {
      'id': '1',
      'question': '배송은 얼마나 걸리나요?',
      'answer': '주문 후 평균 2~3 영업일 이내 배송됩니다.',
    },
    {
      'id': '2',
      'question': '교환/반품은 어떻게 하나요?',
      'answer': '수령 후 7일 이내 고객센터로 문의해 주세요.',
    },
    {
      'id': '3',
      'question': '결제 수단은 어떤 것이 있나요?',
      'answer': '신용카드, 체크카드, 카카오페이 등을 지원합니다.',
    },
  ];
});

/// 정적 공지사항 목록 — 사전 정의 (FR-007)
final noticeProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return const [
    {
      'id': '1',
      'title': '서비스 오픈 안내',
      'content': 'DOA Market이 오픈하였습니다. 이용해 주셔서 감사합니다.',
      'createdAt': '2026-06-01T00:00:00.000Z',
    },
    {
      'id': '2',
      'title': '이용약관 개정 안내',
      'content': '2026년 7월 1일부로 이용약관 일부가 개정됩니다.',
      'createdAt': '2026-06-20T00:00:00.000Z',
    },
  ];
});
