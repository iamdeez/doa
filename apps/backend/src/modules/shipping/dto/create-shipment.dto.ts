import { IsString, IsNotEmpty } from 'class-validator';

export class CreateShipmentDto {
  /** 송장을 등록할 주문 ID */
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  /** 택배사 */
  @IsString()
  @IsNotEmpty()
  carrier!: string;

  /** 운송장 번호 */
  @IsString()
  @IsNotEmpty()
  trackingNumber!: string;
}
