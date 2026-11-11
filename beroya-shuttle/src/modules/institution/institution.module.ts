import { Module } from '@nestjs/common';
import { ResourcesModule } from '../shared/resources/resources.module';
import { InstitutionAttendantsController } from './institution-attendants.controller';
import { InstitutionBranchesController } from './institution-branches.controller';
import { InstitutionBranchesService } from './institution-branches.service';
import { InstitutionDriversController } from './institution-drivers.controller';
import { InstitutionResourcesController } from './institution-resources.controller';
import { InstitutionVehiclesController } from './institution-vehicles.controller';
import { InstitutionController } from './institution.controller';
import { UploadsController } from './uploads.controller';
import { InstitutionService } from './institution.service';
import { MeetingPointsController } from './meeting-points.controller';
import { MeetingPointsService } from './meeting-points.service';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { PeopleUsersService } from './people-users.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { UniversityStudentsController } from './university-students.controller';
import { UniversityStudentsService } from './university-students.service';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { TripsModule } from '../trips/trips.module';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';

@Module({
  imports: [ResourcesModule, TripsModule],
  controllers: [
    InstitutionController,
    UploadsController,
    InstitutionBranchesController,
    InstitutionDriversController,
    InstitutionVehiclesController,
    InstitutionAttendantsController,
    InstitutionResourcesController,
    StudentsController,
    ParentsController,
    UniversityStudentsController,
    MeetingPointsController,
    RoutesController,
    HolidaysController,
  ],
  providers: [
    InstitutionService,
    InstitutionBranchesService,
    PeopleUsersService,
    StudentsService,
    ParentsService,
    UniversityStudentsService,
    MeetingPointsService,
    RoutesService,
    HolidaysService,
  ],
  exports: [InstitutionBranchesService],
})
export class InstitutionModule {}
