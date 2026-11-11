import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { CreateVehicleDto } from '../shared/resources/dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from '../shared/resources/dto/list-vehicles.query';
import { UpdateVehicleStatusDto } from '../shared/resources/dto/update-resource-status.dto';
import { UpdateVehicleDto } from '../shared/resources/dto/update-vehicle.dto';
import { VehiclesService } from '../shared/resources/vehicles.service';

@ApiTags('institution-vehicles')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/vehicles')
export class InstitutionVehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @ApiOperation({
    summary: 'List institution vehicles plus visible Beroya vehicles',
  })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: ListVehiclesQueryDto,
  ) {
    return this.vehicles.listForInstitution(institutionId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Institution-owned vehicle stats' })
  stats(@CurrentUser('institutionId') institutionId: string) {
    return this.vehicles.statsForInstitution(institutionId);
  }

  @Post()
  @ApiOperation({ summary: 'Create an institution-owned vehicle' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateVehicleDto,
  ) {
    return this.vehicles.createForInstitution(actorUserId, institutionId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one institution-visible vehicle' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.getForInstitution(institutionId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an institution-owned vehicle' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVehicleDto,
  ) {
    return this.vehicles.updateForInstitution(
      actorUserId,
      institutionId,
      id,
      body,
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change institution-owned vehicle status' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVehicleStatusDto,
  ) {
    return this.vehicles.updateStatusForInstitution(
      actorUserId,
      institutionId,
      id,
      body.status,
    );
  }
}
