import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { LocationBatchDto } from './dto/location-batch.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { TrackingService } from './tracking.service';

@ApiTags('driver-trips')
@ApiBearerAuth()
@Roles(ShuttleRole.DRIVER)
@Controller('driver/trips')
export class DriverTripsController {
  constructor(private readonly tracking: TrackingService) {}

  @Post(':id/location')
  @HttpCode(200)
  @ApiOperation({ summary: 'Push the current vehicle location' })
  location(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LocationPingDto,
  ) {
    return this.tracking.ingestDriverLocation(userId, id, body);
  }

  @Post(':id/location/batch')
  @HttpCode(200)
  @ApiOperation({ summary: 'Upload queued pings after a network gap' })
  batch(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LocationBatchDto,
  ) {
    return this.tracking.ingestDriverBatch(userId, id, body.pings);
  }
}
