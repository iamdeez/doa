import { IsString } from 'class-validator';

export class RejectSellerDto {
  @IsString()
  rejectReason!: string;
}
