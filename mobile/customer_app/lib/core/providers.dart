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
