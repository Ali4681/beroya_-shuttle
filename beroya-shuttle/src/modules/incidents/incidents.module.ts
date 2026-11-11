import { Module } from '@nestjs/common';
import { AttendantTripsController } from './attendant-trips.controller';
import { DriverIncidentsController } from './driver-incidents.controller';
import { IncidentService } from './incident.service';
import { InstitutionIncidentsController } from './institution-incidents.controller';

@Module({
  controllers: [
    DriverIncidentsController,
    AttendantTripsController,
    InstitutionIncidentsController,
  ],
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentsModule {}
