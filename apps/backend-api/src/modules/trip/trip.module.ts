import { Module } from '@nestjs/common';
import { TripController } from './trip.controller';
import { TripService } from './trip.service';
import { CompanyModule } from '../company/company.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [TripController],
  providers: [TripService],
  exports: [TripService],
})
export class TripModule {}
