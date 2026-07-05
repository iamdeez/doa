import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from './jwt.strategy';
import { isAdminUserId } from './admin-ids';

/**
 * 환경변수 ADMIN_USER_IDS(콤마구분 user id 목록)에 포함된 사용자만 통과.
 * ADMIN_USER_IDS 미설정 또는 빈 값 → 전원 거부(fail-closed).
 * JwtAuthGuard 통과 이후(req.user 존재 전제)에 사용한다.
 *
 * 파싱 로직은 admin-ids.ts 의 isAdminUserId 헬퍼로 위임 (ADR-001 — AuthService 와 공유).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Admin access required');
    }

    if (!isAdminUserId(user.userId, process.env['ADMIN_USER_IDS'])) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
