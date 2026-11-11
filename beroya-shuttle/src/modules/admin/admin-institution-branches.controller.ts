import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { CreateBranchDto } from '../institution/dto/create-branch.dto';
import { UpdateBranchDto } from '../institution/dto/update-branch.dto';
import { UpdateBranchStatusDto } from '../institution/dto/update-branch-status.dto';
import { InstitutionBranchesService } from '../institution/institution-branches.service';

@ApiTags('admin-institutions')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin/institutions/:id/branches')
export class AdminInstitutionBranchesController {
  constructor(private readonly branches: InstitutionBranchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a branch for an institution' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) institutionId: string,
    @Body() body: CreateBranchDto,
  ) {
    return this.branches.create(actorUserId, institutionId, body);
  }

  @Patch(':branchId')
  @ApiOperation({ summary: 'Update branch name, address, or location' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) institutionId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() body: UpdateBranchDto,
  ) {
    return this.branches.update(actorUserId, institutionId, branchId, body);
  }

  @Patch(':branchId/status')
  @ApiOperation({ summary: 'Activate or suspend a branch' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) institutionId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() body: UpdateBranchStatusDto,
  ) {
    return this.branches.updateStatus(
      actorUserId,
      institutionId,
      branchId,
      body,
    );
  }

  @Delete(':branchId')
  @ApiOperation({
    summary: 'Soft-delete a branch when it has no active students or routes',
  })
  remove(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) institutionId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.branches.remove(actorUserId, institutionId, branchId);
  }
}
