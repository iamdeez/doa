import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { PresignDto } from './dto/presign.dto';
import { FileService } from './file.service';

/** /files — 파일 메타데이터·presigned 업로드 (인증 필수) */
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /** POST /files/presign — presigned upload URL + 메타데이터(PENDING) 생성 */
  @Post('presign')
  @HttpCode(HttpStatus.CREATED)
  presign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignDto,
  ) {
    return this.fileService.presign(user.userId, dto);
  }

  /** GET /files/:id — 파일 메타 조회 */
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.fileService.getById(id);
  }

  /** DELETE /files/:id — 본인 소유 파일 삭제 */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.fileService.delete(user.userId, id);
  }
}
