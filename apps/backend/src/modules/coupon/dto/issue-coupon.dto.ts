import { IsString } from 'class-validator';

export class IssueCouponDto {
  @IsString()
  targetUserId!: string;
}
