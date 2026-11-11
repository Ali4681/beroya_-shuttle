import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShuttleRole } from '../../generated/prisma/client';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { UploadsService } from './uploads.service';

@ApiTags('institution-uploads')
@ApiBearerAuth()
@Roles(ShuttleRole.INSTITUTION_ADMIN)
@UseGuards(TenantGuard)
@Controller('institution/uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  @ApiOperation({
    summary: 'Issue a MinIO PUT URL for a logo (≤2MB, square) or student photo (≤1MB)',
  })
  presign(
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: PresignUploadDto,
  ) {
    return this.uploads.presign(institutionId, body);
  }

  @Post('complete')
  @ApiOperation({
    summary: 'Validate the uploaded object; logos must be square',
  })
  complete(
    @CurrentUser('institutionId') institutionId: string,
    @Body() body: CompleteUploadDto,
  ) {
    return this.uploads.complete(institutionId, body);
  }
}
