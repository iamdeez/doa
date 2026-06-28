import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { AddWishlistDto } from './dto/add-wishlist.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ── Profile ───────────────────────────────────────────────────────

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getProfile(user.userId);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.userId, dto);
  }

  // ── Address ───────────────────────────────────────────────────────

  @Get('me/addresses')
  async listAddresses(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.listAddresses(user.userId);
  }

  @Post('me/addresses')
  @HttpCode(HttpStatus.CREATED)
  async createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ) {
    return this.userService.createAddress(user.userId, dto);
  }

  @Patch('me/addresses/:id')
  async updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.userService.updateAddress(user.userId, id, dto);
  }

  @Delete('me/addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.userService.deleteAddress(user.userId, id);
  }

  @Patch('me/addresses/:id/default')
  async setDefaultAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.userService.setDefaultAddress(user.userId, id);
    return { ok: true };
  }

  // ── Wishlist ──────────────────────────────────────────────────────

  @Get('me/wishlist')
  async listWishlist(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.listWishlist(user.userId);
  }

  @Post('me/wishlist')
  @HttpCode(HttpStatus.CREATED)
  async addWishlist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddWishlistDto,
  ) {
    return this.userService.addWishlist(user.userId, dto.productId);
  }

  @Delete('me/wishlist/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeWishlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ) {
    await this.userService.removeWishlist(user.userId, productId);
  }

  // ── Recent views ──────────────────────────────────────────────────

  @Get('me/recent-views')
  async listRecentViews(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.listRecentViews(user.userId);
  }
}
