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
import { CreateDriverDto } from '../shared/resources/dto/create-driver.dto';
import { ListDriversQueryDto } from '../shared/resources/dto/list-drivers.query';
import { UpdateDriverDto } from '../shared/resources/dto/update-driver.dto';
import { UpdateResourceStatusDto } from '../shared/resources/dto/update-resource-status.dto';
import { DriversService } from '../shared/resources/drivers.service';

@ApiTags('admin-drivers')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin/drivers')
export class AdminDriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  @ApiOperation({ summary: 'List Beroya-owned drivers' })
  list(@Query() query: ListDriversQueryDto) {
    return this.drivers.listAdmin(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a Beroya driver' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @Body() body: CreateDriverDto,
  ) {
    return this.drivers.createBeroya(actorUserId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a Beroya driver' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.drivers.getAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a Beroya driver' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDriverDto,
  ) {
    return this.drivers.updateAdmin(actorUserId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change Beroya driver status' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateResourceStatusDto,
  ) {
    return this.drivers.updateStatusAdmin(actorUserId, id, body.status);
  }

  @Get(':id/trips')
  @ApiOperation({ summary: 'List trips for a driver' })
  trips(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.drivers.listTrips(id, query);
  }
}
