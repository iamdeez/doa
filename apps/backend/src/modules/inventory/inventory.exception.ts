import { HttpException, HttpStatus } from '@nestjs/common';

/** 재고 부족 — conditionalDecrement 가 count=0 반환 시 throw (FR-034/035, SC-046) */
export class InsufficientStockException extends HttpException {
  constructor(message = 'Insufficient stock') {
    super(message, HttpStatus.CONFLICT);
  }
}
