import { Injectable } from '@nestjs/common';
import { FileAsset, FilePurpose, FileStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: files 스키마(files.files)에만 접근.
// ownerId 는 cross-schema plain String — users.users.id 참조하지만 FK 미선언.

@Injectable()
export class FileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    ownerId: string;
    purpose: FilePurpose;
    key: string;
    url: string;
    contentType: string;
    size?: number;
    status?: FileStatus;
  }): Promise<FileAsset> {
    return this.prisma.tx.fileAsset.create({ data });
  }

  async findById(id: string): Promise<FileAsset | null> {
    return this.prisma.tx.fileAsset.findUnique({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tx.fileAsset.delete({ where: { id } });
  }
}
