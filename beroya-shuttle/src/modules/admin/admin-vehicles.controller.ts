import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ShuttleRole } from '../../generated/prisma/client';
import { CreateVehicleDto } from '../shared/resources/dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from '../shared/resources/dto/list-vehicles.query';
import { UpdateVehicleDto } from '../shared/resources/dto/update-vehicle.dto';
import { UpdateVehicleStatusDto } from '../shared/resources/dto/update-resource-status.dto';
import { VehiclesService } from '../shared/resources/vehicles.service';

@ApiTags('admin-vehicles')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin/vehicles')
export class AdminVehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'List Beroya-owned vehicles' })
  list(@Query() query: ListVehiclesQueryDto) {
    return this.vehicles.listAdmin(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a Beroya vehicle' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @Body() body: CreateVehicleDto,
  ) {
    return this.vehicles.createBeroya(actorUserId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a Beroya vehicle' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a Beroya vehicle' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVehicleDto,
  ) {
    return this.vehicles.updateAdmin(actorUserId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change Beroya vehicle status' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVehicleStatusDto,
  ) {
    return this.vehicles.updateStatusAdmin(actorUserId, id, body.status);
  }

  @Get(':id/trips')
  @ApiOperation({ summary: 'List trips for a vehicle' })
  trips(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.vehicles.listTrips(id, query);
  }
}
