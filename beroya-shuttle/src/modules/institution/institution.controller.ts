import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { UpdateBrandingDto } from '../admin/dto/update-branding.dto';
import { UpdateInstitutionSettingsDto } from './dto/update-institution-settings.dto';
import { UpdateInstitutionProfileDto } from './dto/update-profile.dto';
import { InstitutionService } from './institution.service';

@ApiTags('institution')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get('bootstrap')
  @ApiOperation({
    summary: 'Bootstrap payload for the current institution',
  })
  bootstrap(
    @CurrentUser('sub') userId: string,
    @CurrentUser('institutionId') institutionId: string,
  ) {
    return this.institutionService.bootstrap(userId, institutionId);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Current institution profile' })
  profile(@CurrentUser('institutionId') institutionId: string) {
    return this.institutionService.getProfile(institutionId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update the current institution profile' })
  updateProfile(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: UpdateInstitutionProfileDto,
  ) {
    return this.institutionService.updateProfile(actorUserId, institutionId, body);
  }

  @Get('branding')
  @ApiOperation({ summary: 'Current institution branding' })
  branding(@CurrentUser('institutionId') institutionId: string) {
    return this.institutionService.getBranding(institutionId);
  }

  @Patch('branding')
  @ApiOperation({
    summary:
      'Update branding (hex colors, no HTML). logo_url must come from POST /institution/uploads/complete',
  })
  updateBranding(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: UpdateBrandingDto,
  ) {
    return this.institutionService.updateBranding(
      actorUserId,
      institutionId,
      body,
    );
  }

  @Get('settings')
  @ApiOperation({ summary: 'Current institution settings' })
  settings(@CurrentUser('institutionId') institutionId: string) {
    return this.institutionService.getSettings(institutionId);
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Update timezone and default alert thresholds',
  })
  updateSettings(
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: UpdateInstitutionSettingsDto,
  ) {
    return this.institutionService.updateSettings(
      actorUserId,
      institutionId,
      body,
    );
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Read-only current subscription with days remaining' })
  subscription(@CurrentUser('institutionId') institutionId: string) {
    return this.institutionService.getSubscription(institutionId);
  }
}
