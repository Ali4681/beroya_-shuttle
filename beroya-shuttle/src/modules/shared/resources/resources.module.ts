import { Module } from '@nestjs/common';
import { AttendantsService } from './attendants.service';
import { DriversService } from './drivers.service';
import { VehiclesService } from './vehicles.service';

@Module({
  providers: [DriversService, VehiclesService, AttendantsService],
  exports: [DriversService, VehiclesService, AttendantsService],
})
export class ResourcesModule {}
