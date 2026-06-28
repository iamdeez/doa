import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 워크스페이스 패키지(@doa/*)를 TS 소스 그대로 트랜스파일 (빌드 산출물 없이 src 직접 소비).
  transpilePackages: ['@doa/api-client', '@doa/shared-types', '@doa/ui'],
  reactStrictMode: true,
};

export default nextConfig;
