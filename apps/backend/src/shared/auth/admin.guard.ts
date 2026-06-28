import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from './jwt.strategy';

/**
 * 환경변수 ADMIN_USER_IDS(콤마구분 user id 목록)에 포함된 사용자만 통과.
 * ADMIN_USER_IDS 미설정 또는 빈 값 → 전원 거부(fail-closed).
 * JwtAuthGuard 통과 이후(req.user 존재 전제)에 사용한다.
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

    const raw = process.env['ADMIN_USER_IDS'] ?? '';
    const adminIds = raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (adminIds.length === 0 || !adminIds.includes(user.userId)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
