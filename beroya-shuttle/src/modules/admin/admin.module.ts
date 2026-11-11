import { Module } from '@nestjs/common';
import { InstitutionModule } from '../institution/institution.module';
import { ResourcesModule } from '../shared/resources/resources.module';
import { TrackingModule } from '../tracking/tracking.module';
import { AdminDriversController } from './admin-drivers.controller';
import { AdminInstitutionBranchesController } from './admin-institution-branches.controller';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminVehiclesController } from './admin-vehicles.controller';
import { AdminUploadsController } from './admin-uploads.controller';
import { AdminController } from './admin.controller';
import { AppBrandingController } from './app-branding.controller';
import { AppBrandingService } from './app-branding.service';
import { SupportContactController } from './support-contact.controller';
import { AdminService } from './admin.service';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [ResourcesModule, InstitutionModule, TrackingModule],
  controllers: [
    AdminController,
    AppBrandingController,
    SupportContactController,
    AdminUploadsController,
    InstitutionsController,
    AdminInstitutionBranchesController,
    SubscriptionsController,
    AdminDriversController,
    AdminVehiclesController,
    AdminOperationsController,
  ],
  providers: [
    AdminService,
    AppBrandingService,
    InstitutionsService,
    SubscriptionsService,
    AdminOperationsService,
  ],
})
export class AdminModule {}
