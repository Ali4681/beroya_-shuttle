import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { UseGuards } from '@nestjs/common';
import { ShuttleRole } from '../../generated/prisma/client';
import { LiveMapQueryDto } from './dto/live-map.query';
import { TrackingService } from './tracking.service';

@ApiTags('institution-live')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution')
export class LiveMapController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('trips/:id/live')
  @ApiOperation({ summary: 'Live location, ETA and GPS freshness for a trip' })
  liveTrip(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tracking.getLiveTrip(institutionId, id);
  }

  @Get('live-map')
  @ApiOperation({ summary: 'Live map points from Redis' })
  liveMap(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: LiveMapQueryDto,
  ) {
    return this.tracking.liveMap(institutionId, query);
  }

  @Get('dashboard/live-trips')
  @ApiOperation({ summary: 'Today scheduled and in-progress trips with live fields' })
  dashboardLiveTrips(@CurrentUser('institutionId') institutionId: string) {
    return this.tracking.dashboardLiveTrips(institutionId);
  }

  @Get('dashboard/live-map')
  @ApiOperation({ summary: 'Dashboard live map — Redis locations only' })
  dashboardLiveMap(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: LiveMapQueryDto,
  ) {
    return this.tracking.liveMap(institutionId, query);
  }
}
