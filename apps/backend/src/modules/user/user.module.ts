import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { UserController } from './user.controller';
import { UserEventsHandler } from './user.events';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  imports: [AuthSharedModule],
  controllers: [UserController],
  providers: [UserService, UserRepository, UserEventsHandler],
})
export class UserModule {}
