import { Module } from '@nestjs/common';
import { RolesController, PermissionsController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [RolesController, PermissionsController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
