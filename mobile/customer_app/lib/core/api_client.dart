import 'package:dio/dio.dart';

import 'env.dart';
import 'token_store.dart';

/// dio 기반 API 클라이언트 — 토큰 주입 + 401 자동 refresh(원요청 재시도).
class ApiClient {
  ApiClient(this._tokens) {
    dio = Dio(BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Accept': 'application/json'},
    ));
    dio.interceptors.add(_authInterceptor());
  }

  final TokenStore _tokens;
  late final Dio dio;
  Future<bool>? _refreshing;

  Interceptor _authInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (options.extra['anonymous'] != true) {
          final token = await _tokens.accessToken;
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (e, handler) async {
        final res = e.response;
        final req = e.requestOptions;
        if (res?.statusCode == 401 &&
            req.extra['anonymous'] != true &&
            req.extra['retried'] != true) {
          final ok = await _ensureRefreshed();
          if (ok) {
            req.extra['retried'] = true;
            final token = await _tokens.accessToken;
            if (token != null) req.headers['Authorization'] = 'Bearer $token';
            try {
              final clone = await dio.fetch<dynamic>(req);
              return handler.resolve(clone);
            } catch (err) {
              return handler.next(err is DioException ? err : e);
            }
          }
        }
        handler.next(e);
      },
    );
  }

  Future<bool> _ensureRefreshed() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refreshToken = await _tokens.refreshToken;
    if (refreshToken == null) return false;
    try {
      final res = await Dio(BaseOptions(baseUrl: apiBaseUrl)).post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final access = res.data?['accessToken'] as String?;
      if (access == null) {
        await _tokens.clear();
        return false;
      }
      await _tokens.saveAccess(access);
      return true;
    } catch (_) {
      await _tokens.clear();
      return false;
    }
  }
}
