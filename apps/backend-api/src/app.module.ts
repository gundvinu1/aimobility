import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigModule } from './modules/config/config.module';
import { AppLoggerModule } from './modules/logger/logger.module';
import { DatabaseModule } from './modules/database/database.module';
import { CacheModule } from './modules/cache/cache.module';
import { QueueModule } from './modules/queue/queue.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './modules/common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { VehicleModule } from './modules/vehicle/vehicle.module';
import { DriverModule } from './modules/driver/driver.module';
import { BookingModule } from './modules/booking/booking.module';
import { TripModule } from './modules/trip/trip.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    // Core infrastructure modules - order matters
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    CacheModule,
    QueueModule,
    RateLimitModule,
    HealthModule,
    CommonModule,
    // Business modules
    AuthModule,
    RbacModule,
    CompanyModule,
    EmployeeModule,
    VehicleModule,
    DriverModule,
    BookingModule,
    TripModule,
  ],
  providers: [
    // Apply JWT guard globally — use @Public() to opt-out
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
