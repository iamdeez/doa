import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const accessSecret = configService.get<string>('jwt.accessSecret');
    // jwtConfig startup validation already ensures this is set;
    // guard here prevents misleading "no secret" errors at strategy init time
    if (!accessSecret) {
      throw new UnauthorizedException('JWT access secret is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return { userId: payload.sub, email: payload.email };
  }
}
