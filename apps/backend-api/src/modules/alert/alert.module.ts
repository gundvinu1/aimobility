import { Module, forwardRef } from '@nestjs/common';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';
import { AlertEvaluationService } from './alert-evaluation.service';
import { GeofenceModule } from '../geofence/geofence.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    GeofenceModule,
    CacheModule,
    forwardRef(() => TelemetryModule),
  ],
  controllers: [AlertController],
  providers: [AlertService, AlertEvaluationService],
  exports: [AlertService, AlertEvaluationService],
})
export class AlertModule {}
