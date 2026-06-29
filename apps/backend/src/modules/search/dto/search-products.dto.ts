import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SEARCH_SORTS, SearchSort } from '../search.constants';

/** GET /search/products query params (006-search) */
export class SearchProductsDto {
  /** 키워드 — 상품명 부분일치 */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  /** 최소 가격 — 금전 문자열(부동소수점 오차 방지, Decimal 변환 전제) */
  @IsOptional()
  @IsNumberString()
  minPrice?: string;

  /** 최대 가격 */
  @IsOptional()
  @IsNumberString()
  maxPrice?: string;

  @IsOptional()
  @IsIn(SEARCH_SORTS)
  sort?: SearchSort;

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
