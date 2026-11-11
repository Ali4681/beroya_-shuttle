import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { AdminService } from './admin.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { UpdateSupportContactDto } from './dto/update-support-contact.dto';

@ApiTags('platform')
@Controller()
export class SupportContactController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Get('public/support-contact')
  @ApiOperation({ summary: 'WhatsApp number used by the public site' })
  supportContact() {
    return this.adminService.getSupportContact();
  }

  @Public()
  @Get('public/app-config')
  @ApiOperation({
    summary: 'Tracking defaults and mobile app version gates for all four apps',
  })
  appConfig() {
    return this.adminService.getPlatformSettings();
  }

  @ApiBearerAuth()
  @Roles(ShuttleRole.BEROYA_ADMIN)
  @Get('admin/platform-settings')
  @ApiOperation({ summary: 'Read Beroya platform settings' })
  getPlatformSettings() {
    return this.adminService.getPlatformSettings();
  }

  @ApiBearerAuth()
  @Roles(ShuttleRole.BEROYA_ADMIN)
  @Put('admin/platform-settings')
  @ApiOperation({ summary: 'Update Beroya platform settings' })
  updatePlatformSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.adminService.updatePlatformSettings(dto);
  }

  @ApiBearerAuth()
  @Roles(ShuttleRole.BEROYA_ADMIN)
  @Put('admin/support-contact')
  @ApiOperation({ summary: 'Set the Beroya support WhatsApp number' })
  updateSupportContact(@Body() dto: UpdateSupportContactDto) {
    return this.adminService.updateSupportContact(dto.supportPhone);
  }
}
