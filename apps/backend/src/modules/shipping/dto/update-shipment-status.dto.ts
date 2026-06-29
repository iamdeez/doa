import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ShipmentStatus } from '@prisma/client';

export class UpdateShipmentStatusDto {
  /** 변경할 배송 상태 (shipped · in_transit · delivered) */
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;

  /** 추적 이력에 남길 설명 (선택) */
  @IsOptional()
  @IsString()
  description?: string;
}
