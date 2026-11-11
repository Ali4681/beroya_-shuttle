import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module';
import { ParentAbsenceService } from './parent-absence.service';
import { ParentAppController } from './parent-app.controller';
import { PassengerService } from './passenger.service';
import { UniversityAppController } from './university-app.controller';

@Module({
  imports: [TrackingModule],
  controllers: [ParentAppController, UniversityAppController],
  providers: [PassengerService, ParentAbsenceService],
  exports: [PassengerService, ParentAbsenceService],
})
export class PassengerModule {}
