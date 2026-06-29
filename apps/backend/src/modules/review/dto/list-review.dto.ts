import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListReviewsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  take?: number;
}
