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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { CreateDriverDto } from '../shared/resources/dto/create-driver.dto';
import { ListDriversQueryDto } from '../shared/resources/dto/list-drivers.query';
import { UpdateDriverDto } from '../shared/resources/dto/update-driver.dto';
import { UpdateResourceStatusDto } from '../shared/resources/dto/update-resource-status.dto';
import { DriversService } from '../shared/resources/drivers.service';

@ApiTags('institution-drivers')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/drivers')
export class InstitutionDriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  @ApiOperation({
    summary: 'List institution drivers plus visible Beroya drivers',
  })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: ListDriversQueryDto,
  ) {
    return this.drivers.listForInstitution(institutionId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Institution-owned driver stats' })
  stats(@CurrentUser('institutionId') institutionId: string) {
    return this.drivers.statsForInstitution(institutionId);
  }

  @Post()
  @ApiOperation({ summary: 'Create an institution-owned driver' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateDriverDto,
  ) {
    return this.drivers.createForInstitution(actorUserId, institutionId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one institution-visible driver' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.drivers.getForInstitution(institutionId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an institution-owned driver' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDriverDto,
  ) {
    return this.drivers.updateForInstitution(
      actorUserId,
      institutionId,
      id,
      body,
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change institution-owned driver status' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateResourceStatusDto,
  ) {
    return this.drivers.updateStatusForInstitution(
      actorUserId,
      institutionId,
      id,
      body.status,
    );
  }

  @Get(':id/trips')
  @ApiOperation({ summary: 'List trips assigned to this driver' })
  trips(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.drivers.listTrips(id, query, institutionId);
  }
}
