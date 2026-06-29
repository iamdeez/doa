import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { FILE_STORAGE } from './file-storage.port';
import { FileController } from './file.controller';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { StubFileStorage } from './stub-file-storage';

/**
 * 파일 메타데이터 모듈 (006-file).
 * 객체 스토리지(R2) 연동은 FileStoragePort(stub) 추상화 — P-002.
 * FileService 를 export — 타 도메인이 public URL 조회 등에 활용 가능.
 */
@Module({
  imports: [AuthSharedModule],
  controllers: [FileController],
  providers: [
    FileService,
    FileRepository,
    { provide: FILE_STORAGE, useClass: StubFileStorage },
  ],
  exports: [FileService],
})
export class FileModule {}
