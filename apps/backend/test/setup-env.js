// e2e 테스트 환경 설정
// pino-pretty는 개발자 로컬 환경 전용 transport이므로
// CI/e2e 테스트에서는 production 모드(JSON 로그)로 실행한다.
// app.module.ts: process.env.NODE_ENV !== 'production' → false → pino-pretty 미사용
process.env.NODE_ENV = 'production';
