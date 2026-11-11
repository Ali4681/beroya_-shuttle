import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateBranchStatusDto } from './dto/update-branch-status.dto';
import { InstitutionBranchesService } from './institution-branches.service';

@ApiTags('institution-branches')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/branches')
export class InstitutionBranchesController {
  constructor(private readonly branches: InstitutionBranchesService) {}

  @Get()
  @ApiOperation({ summary: 'List institution branches' })
  list(@CurrentUser('institutionId') institutionId: string) {
    return this.branches.list(institutionId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a branch with location' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CreateBranchDto,
  ) {
    return this.branches.create(actorUserId, institutionId, body);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Student, route, and today trip counts' })
  stats(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.branches.stats(institutionId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one branch' })
  getById(
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.branches.getById(institutionId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update branch name, address, or location' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBranchDto,
  ) {
    return this.branches.update(actorUserId, institutionId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or suspend a branch' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBranchStatusDto,
  ) {
    return this.branches.updateStatus(actorUserId, institutionId, id, body);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete a branch when it has no active students or routes',
  })
  remove(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.branches.remove(actorUserId, institutionId, id);
  }
}
