import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { UPLOAD_PURPOSES } from '../../../infra/storage/storage.constants';

export class CompleteUploadDto {
  @ApiProperty({ enum: UPLOAD_PURPOSES })
  @IsIn(UPLOAD_PURPOSES)
  purpose!: (typeof UPLOAD_PURPOSES)[number];

  @ApiProperty({
    example: 'institutions/11111111-1111-4111-8111-111111111111/logos/abc.png',
  })
  @IsString()
  @Matches(/^institutions\/[a-zA-Z0-9-]+\/(logos|students)\/[a-zA-Z0-9._-]+$/)
  objectKey!: string;
}
