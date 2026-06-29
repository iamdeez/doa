/// 백엔드 베이스 URL (글로벌 프리픽스 없음). 빌드 시 --dart-define=API_BASE_URL=... 로 주입 가능.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000',
);
