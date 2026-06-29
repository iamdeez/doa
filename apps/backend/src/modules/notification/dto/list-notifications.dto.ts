import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** GET /notifications query params (006-notification) */
export class ListNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number;
}
