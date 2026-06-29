import { IsInt, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  orderItemId!: string;

  /** 평점 1~5 정수 (FR-022·SC-034) */
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  content!: string;
}
