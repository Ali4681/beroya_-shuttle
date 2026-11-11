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
import { ShuttleRole } from '../../generated/prisma/client';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions.query';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('admin-subscriptions')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('subscriptions')
  @ApiOperation({ summary: 'List all institution subscriptions' })
  list(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptions.list(query);
  }

  @Get('institutions/:id/subscriptions')
  @ApiOperation({ summary: 'List subscriptions for one institution' })
  listForInstitution(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListSubscriptionsQueryDto,
  ) {
    return this.subscriptions.listForInstitution(id, query);
  }

  @Post('institutions/:id/subscriptions')
  @ApiOperation({ summary: 'Create a pending subscription' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateSubscriptionDto,
  ) {
    return this.subscriptions.create(actorUserId, id, body);
  }

  @Patch('institutions/:id/subscriptions/:sid')
  @ApiOperation({ summary: 'Update a pending subscription' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sid', ParseUUIDPipe) sid: string,
    @Body() body: UpdateSubscriptionDto,
  ) {
    return this.subscriptions.update(actorUserId, id, sid, body);
  }

  @Post('institutions/:id/subscriptions/:sid/activate')
  @ApiOperation({ summary: 'Activate a pending subscription' })
  activate(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sid', ParseUUIDPipe) sid: string,
  ) {
    return this.subscriptions.activate(actorUserId, id, sid);
  }

  @Post('institutions/:id/subscriptions/:sid/cancel')
  @ApiOperation({ summary: 'Cancel a pending or active subscription' })
  cancel(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sid', ParseUUIDPipe) sid: string,
    @Body() body: CancelSubscriptionDto,
  ) {
    return this.subscriptions.cancel(actorUserId, id, sid, body);
  }

  @Post('institutions/:id/subscriptions/:sid/extend')
  @ApiOperation({ summary: 'Extend an active subscription end date' })
  extend(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sid', ParseUUIDPipe) sid: string,
    @Body() body: ExtendSubscriptionDto,
  ) {
    return this.subscriptions.extend(actorUserId, id, sid, body);
  }
}
