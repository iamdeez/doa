import { BannerPosition } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBannerDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  /** 클릭 이동 대상 URL (없으면 비링크 배너) */
  @IsOptional()
  @IsString()
  linkUrl?: string;

  /** 노출 위치 (미지정 시 기본 MAIN_TOP) */
  @IsOptional()
  @IsEnum(BannerPosition)
  position?: BannerPosition;

  /** 동일 위치 내 정렬 순서 (오름차순) */
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  /** 활성 여부 (미지정 시 기본 true) */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 노출 시작 (ISO 8601, null=즉시) */
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  /** 노출 종료 (ISO 8601, null=무제한) */
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
