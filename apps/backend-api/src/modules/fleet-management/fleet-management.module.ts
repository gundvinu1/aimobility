import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CompanyModule } from '../company/company.module';
import { CacheModule } from '../cache/cache.module';
import { AlertModule } from '../alert/alert.module';

// Controllers
import { FuelController } from './controllers/fuel.controller';
import { MaintenanceController } from './controllers/maintenance.controller';
import { WorkOrderController } from './controllers/work-order.controller';
import { VendorController } from './controllers/vendor.controller';
import { ExpenseController } from './controllers/expense.controller';
import { CostAnalyticsController } from './controllers/cost-analytics.controller';

// Services
import { FuelService } from './services/fuel.service';
import { MaintenanceService } from './services/maintenance.service';
import { WorkOrderService } from './services/work-order.service';
import { VendorService } from './services/vendor.service';
import { ExpenseService } from './services/expense.service';

@Module({
  imports: [
    DatabaseModule,
    CompanyModule,
    CacheModule,
    forwardRef(() => AlertModule),
  ],
  controllers: [
    FuelController,
    MaintenanceController,
    WorkOrderController,
    VendorController,
    ExpenseController,
    CostAnalyticsController,
  ],
  providers: [
    FuelService,
    MaintenanceService,
    WorkOrderService,
    VendorService,
    ExpenseService,
  ],
  exports: [
    FuelService,
    MaintenanceService,
    WorkOrderService,
    VendorService,
    ExpenseService,
  ],
})
export class FleetManagementModule {}
