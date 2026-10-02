import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { CompanyModule } from '../company/company.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
