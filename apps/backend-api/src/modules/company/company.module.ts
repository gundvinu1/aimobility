import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { TenantGuard } from './guards/tenant.guard';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CompanyController],
  providers: [CompanyService, TenantGuard],
  exports: [CompanyService, TenantGuard],
})
export class CompanyModule {}
