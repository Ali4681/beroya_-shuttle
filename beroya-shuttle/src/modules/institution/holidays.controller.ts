import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { HolidaysQueryDto } from './dto/holidays.query';
import { HolidaysService } from './holidays.service';

@ApiTags('institution')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  @ApiOperation({ summary: 'List institution holidays (optional from/to)' })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: HolidaysQueryDto,
  ) {
    return this.holidays.list(institutionId, query.from, query.to);
  }

  @Post()
  @ApiOperation({ summary: 'Add a holiday date for the school calendar' })
  create(
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateHolidayDto,
  ) {
    return this.holidays.create(institutionId, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a holiday date' })
  remove(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.holidays.remove(institutionId, id);
  }
}
