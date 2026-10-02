import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { CompanyModule } from '../company/company.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
