// Review domain events — in-process via @nestjs/event-emitter (FR-023)

export interface ReviewCreatedPayload {
  reviewId: string;
  orderItemId: string;
  orderId: string;
  productId: string;
  userId: string;
  rating: number;
}
