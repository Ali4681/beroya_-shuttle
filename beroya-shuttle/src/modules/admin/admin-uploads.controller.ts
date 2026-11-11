import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { CompleteUploadDto } from '../institution/dto/complete-upload.dto';
import { PresignUploadDto } from '../institution/dto/presign-upload.dto';
import { UploadsService } from '../institution/uploads.service';

@ApiTags('admin-uploads')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin/institutions')
export class AdminUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post(':id/uploads/presign')
  @ApiOperation({
    summary: 'Presign a logo or student-photo upload for this institution',
  })
  presign(
    @Param('id', ParseUUIDPipe) institutionId: string,
    @Body() body: PresignUploadDto,
  ) {
    return this.uploads.presign(institutionId, body);
  }

  @Post(':id/uploads/complete')
  @ApiOperation({
    summary: 'Validate the uploaded file; reject a non-square logo',
  })
  complete(
    @Param('id', ParseUUIDPipe) institutionId: string,
    @Body() body: CompleteUploadDto,
  ) {
    return this.uploads.complete(institutionId, body);
  }
}
