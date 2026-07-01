/**
 * 이메일 주소를 마스킹한다.
 * local 파트 최대 2자 노출, 나머지 ** 로 치환.
 * 예: ab@example.com → ab**@example.com, a@example.com → a**@example.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}**@${domain}`;
}
