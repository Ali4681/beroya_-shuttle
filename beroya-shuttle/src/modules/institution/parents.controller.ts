import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { ListParentsQueryDto } from './dto/list-parents.query';
import { UpdateParentDto } from './dto/update-parent.dto';
import { ParentsService } from './parents.service';

@ApiTags('institution-parents')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/parents')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Get()
  @ApiOperation({ summary: 'List parents with their students' })
  list(
    @CurrentUser('institutionId') institutionId: string,
    @Query() query: ListParentsQueryDto,
  ) {
    return this.parents.list(institutionId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one parent and linked students' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.parents.getById(institutionId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update parent name or phone; phone change revokes sessions',
  })
  update(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateParentDto,
  ) {
    return this.parents.update(actorUserId, institutionId, id, body);
  }
}
