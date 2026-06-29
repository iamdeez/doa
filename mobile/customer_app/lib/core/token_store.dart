import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// JWT 액세스·리프레시 토큰 보안 저장(secure storage).
class TokenStore {
  TokenStore(this._storage);
  final FlutterSecureStorage _storage;

  static const _access = 'accessToken';
  static const _refresh = 'refreshToken';

  Future<String?> get accessToken => _storage.read(key: _access);
  Future<String?> get refreshToken => _storage.read(key: _refresh);

  Future<void> save({required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _access, value: accessToken);
    await _storage.write(key: _refresh, value: refreshToken);
  }

  Future<void> saveAccess(String accessToken) =>
      _storage.write(key: _access, value: accessToken);

  Future<void> clear() async {
    await _storage.delete(key: _access);
    await _storage.delete(key: _refresh);
  }
}
