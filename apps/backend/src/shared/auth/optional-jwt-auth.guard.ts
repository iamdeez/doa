import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 선택적 JWT 인증 가드. 토큰 부재/무효 시 401 미발생 — user = undefined 로 통과.
 * 유효 토큰 존재 시 request.user 에 AuthenticatedUser 주입.
 * 사용처: GET /products/:id (로그인 사용자에게 조회 기록 저장 부가 기능 ADR-012)
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest(_err: any, user: any): any {
    return user ?? undefined;
  }
}
