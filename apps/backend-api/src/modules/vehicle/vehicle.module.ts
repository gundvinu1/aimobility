import { Module } from '@nestjs/common';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';
import { CompanyModule } from '../company/company.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [VehicleController],
  providers: [VehicleService],
  exports: [VehicleService],
})
export class VehicleModule {}
