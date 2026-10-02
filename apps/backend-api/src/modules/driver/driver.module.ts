import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { CompanyModule } from '../company/company.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
