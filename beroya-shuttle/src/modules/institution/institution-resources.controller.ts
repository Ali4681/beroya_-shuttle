import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { AttendantsService } from '../shared/resources/attendants.service';
import { AvailabilityQueryDto } from '../shared/resources/dto/availability.query';
import { DriversService } from '../shared/resources/drivers.service';
import { VehiclesService } from '../shared/resources/vehicles.service';

@ApiTags('institution-resources')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/resources')
export class InstitutionResourcesController {
  constructor(
    private readonly drivers: DriversService,
    private readonly vehicles: VehiclesService,
    private readonly attendants: AttendantsService,
  ) {}

  @Get('available-drivers')
  @ApiOperation({
    summary: 'Active drivers free at the given date/time for a dropdown',
  })
  availableDrivers(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.drivers.availableForInstitution(institutionId, query);
  }

  @Get('available-vehicles')
  @ApiOperation({
    summary: 'Active vehicles free at the given date/time for a dropdown',
  })
  availableVehicles(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.vehicles.availableForInstitution(institutionId, query);
  }

  @Get('available-attendants')
  @ApiOperation({
    summary: 'Active attendants not already assigned to a route',
  })
  availableAttendants(@CurrentUser('institutionId') institutionId: string) {
    return this.attendants.available(institutionId);
  }
}
