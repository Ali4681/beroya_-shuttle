import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { AppBrandingService } from './app-branding.service';
import { AppBrandingQueryDto } from './dto/app-branding-query.dto';
import {
  CompleteAppBrandingUploadDto,
  PresignAppBrandingUploadDto,
  UpdateAppBrandingDto,
} from './dto/update-app-branding.dto';

@ApiTags('app-branding')
@Controller()
export class AppBrandingController {
  constructor(private readonly branding: AppBrandingService) {}

  @Public()
  @Get('public/app-branding')
  @ApiOperation({
    summary: 'Published Flutter branding for passenger or crew apps',
  })
  published(@Query() query: AppBrandingQueryDto) {
    return this.branding.getPublished(query.app ?? 'passenger');
  }

  @ApiBearerAuth()
  @Roles(ShuttleRole.BEROYA_ADMIN)
  @Get('admin/app-branding')
  @ApiOperation({ summary: 'Draft and published Flutter branding' })
  adminGet(@Query() query: AppBrandingQueryDto) {
    return this.branding.getAdmin(query.app ?? 'passenger');
  }

  @ApiBearerAuth()
  @Roles(ShuttleRole.BEROYA_ADMIN)
  @Put('admin/app-branding')
  @ApiOperation({ summary: 'Save Flutter branding draft without publishing' })
  saveDraft(
    @Query() query: AppBrandingQueryDto,
    @Body() body: UpdateAppBrandingDto,
  ) {
    return this.branding.saveDraft(query.app ?? 'passenger', body);
  }

  @ApiBearerAuth()
  @Roles(ShuttleRole.BEROYA_ADMIN)
  @Post('admin/app-branding/publish')
  @ApiOperation({
    summary: 'Publish the draft and increment the branding version',
  })
  publish(@Query() query: AppBrandingQueryDto) {
    return this.branding.publish(query.app ?? 'passenger');
  }

  @ApiBearerAuth()
  @Roles(ShuttleRole.BEROYA_ADMIN)
  @Post('admin/app-branding/uploads/presign')
  @ApiOperation({ summary: 'Presign a branding asset upload' })
  presign(
    @Query() query: AppBrandingQueryDto,
    @Body() body: PresignAppBrandingUploadDto,
  ) {
    return this.branding.presign(query.app ?? 'passenger', body);
  }

  @ApiBearerAuth()
  @Roles(ShuttleRole.BEROYA_ADMIN)
  @Post('admin/app-branding/uploads/complete')
  @ApiOperation({ summary: 'Validate a branding asset after upload' })
  complete(
    @Query() query: AppBrandingQueryDto,
    @Body() body: CompleteAppBrandingUploadDto,
  ) {
    return this.branding.complete(query.app ?? 'passenger', body);
  }
}
