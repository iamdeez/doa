import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { CartService } from './cart.service';
import { CartItemResponse, CartResponse } from './dto/cart-response.dto';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /** GET /cart — 장바구니 조회 */
  @Get()
  @ApiOkResponse({ type: CartResponse })
  async getCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.getCart(user.userId);
  }

  /** POST /cart/items — 장바구니 항목 추가 */
  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [CartItemResponse] })
  async addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(user.userId, { variantId: dto.variantId, quantity: dto.quantity });
  }

  /** PUT /cart/items/:variantId — 수량 변경 (0이면 삭제) */
  @Put('items/:variantId')
  @ApiOkResponse({ type: [CartItemResponse] })
  async updateQuantity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateQuantity(user.userId, variantId, dto.quantity);
  }

  /** DELETE /cart/items/:variantId — 항목 제거 */
  @Delete('items/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId') variantId: string,
  ) {
    await this.cartService.removeItem(user.userId, variantId);
  }
}
