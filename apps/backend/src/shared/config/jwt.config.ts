import { registerAs } from '@nestjs/config';

/** NFR-003: Access Token 유효 기간 15분(900초) */
export const JWT_ACCESS_TTL_SECONDS = 900;

/** NFR-004: Refresh Token 유효 기간 30일 */
export const JWT_REFRESH_TTL_DAYS = 30;

export const jwtConfig = registerAs('jwt', () => {
  const accessSecret = process.env['JWT_ACCESS_SECRET'];
  const refreshSecret = process.env['JWT_REFRESH_SECRET'];

  if (!accessSecret) {
    throw new Error('JWT_ACCESS_SECRET environment variable is not set');
  }
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  }

  return {
    accessSecret,
    refreshSecret,
    accessTtlSeconds: JWT_ACCESS_TTL_SECONDS,
    refreshTtlDays: JWT_REFRESH_TTL_DAYS,
  };
});
