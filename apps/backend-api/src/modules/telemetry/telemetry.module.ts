import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { CompanyModule } from '../company/company.module';
import { AuthModule } from '../auth/auth.module';
import { AlertModule } from '../alert/alert.module';
import { TelemetryService } from './telemetry.service';
import { TelemetryGateway } from './telemetry.gateway';
import { TelemetryController, FleetTrackingController } from './telemetry.controller';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    CompanyModule,
    AuthModule,
    forwardRef(() => AlertModule),
  ],
  controllers: [
    TelemetryController,
    FleetTrackingController,
  ],
  providers: [
    TelemetryService,
    TelemetryGateway,
  ],
  exports: [
    TelemetryService,
    TelemetryGateway,
  ],
})
export class TelemetryModule {}
