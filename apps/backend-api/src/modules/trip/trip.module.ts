import { Module, forwardRef } from '@nestjs/common';
import { TripController } from './trip.controller';
import { TripService } from './trip.service';
import { MockRoutingProvider } from './routing/mock-routing.provider';
import { RoutingService } from './routing/routing.service';
import { CompanyModule } from '../company/company.module';
import { DatabaseModule } from '../database/database.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [DatabaseModule, CompanyModule, forwardRef(() => TelemetryModule)],
  controllers: [TripController],
  providers: [
    TripService,
    MockRoutingProvider,
    RoutingService,
  ],
  exports: [TripService, RoutingService],
})
export class TripModule {}
