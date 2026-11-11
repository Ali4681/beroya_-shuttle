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
import { ChangeAdminDto } from './dto/change-admin.dto';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { ListInstitutionsQueryDto } from './dto/list-institutions.query';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { UpdateInstitutionStatusDto } from './dto/update-institution-status.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { InstitutionsService } from './institutions.service';

@ApiTags('admin-institutions')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin/institutions')
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Get()
  @ApiOperation({ summary: 'List institutions' })
  list(@Query() query: ListInstitutionsQueryDto) {
    return this.institutions.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create institution with admin, settings, and main branch' })
  create(
    @CurrentUser('sub') actorUserId: string,
    @Body() body: CreateInstitutionDto,
  ) {
    return this.institutions.create(actorUserId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get institution detail' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutions.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update institution profile' })
  update(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateInstitutionDto,
  ) {
    return this.institutions.update(actorUserId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or suspend an institution' })
  updateStatus(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateInstitutionStatusDto,
  ) {
    return this.institutions.updateStatus(actorUserId, id, body);
  }

  @Post(':id/change-admin')
  @ApiOperation({ summary: 'Replace the primary institution admin' })
  changeAdmin(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeAdminDto,
  ) {
    return this.institutions.changeAdmin(actorUserId, id, body);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Institution operational counts' })
  stats(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutions.stats(id);
  }

  @Get(':id/branches')
  @ApiOperation({ summary: 'List institution branches' })
  branches(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutions.listBranches(id);
  }

  @Get(':id/branding')
  @ApiOperation({ summary: 'Get institution branding' })
  branding(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutions.getBranding(id);
  }

  @Patch(':id/branding')
  @ApiOperation({
    summary:
      'Update institution branding. logo_url must come from POST /admin/institutions/:id/uploads/complete',
  })
  updateBranding(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBrandingDto,
  ) {
    return this.institutions.updateBranding(actorUserId, id, body);
  }

  @Get(':id/settings')
  @ApiOperation({ summary: 'Get institution settings' })
  settings(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutions.getSettings(id);
  }

  @Patch(':id/settings')
  @ApiOperation({ summary: 'Update institution settings' })
  updateSettings(
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSettingsDto,
  ) {
    return this.institutions.updateSettings(actorUserId, id, body);
  }
}
