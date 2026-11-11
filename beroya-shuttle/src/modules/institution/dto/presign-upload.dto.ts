import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import {
  ALLOWED_UPLOAD_MIME,
  LOGO_MAX_BYTES,
  UPLOAD_PURPOSES,
} from '../../../infra/storage/storage.constants';

export class PresignUploadDto {
  @ApiProperty({ enum: UPLOAD_PURPOSES })
  @IsIn(UPLOAD_PURPOSES)
  purpose!: (typeof UPLOAD_PURPOSES)[number];

  @ApiProperty({ enum: ALLOWED_UPLOAD_MIME, example: 'image/png' })
  @IsString()
  @IsIn(ALLOWED_UPLOAD_MIME)
  contentType!: (typeof ALLOWED_UPLOAD_MIME)[number];

  @ApiProperty({ example: 12_288 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LOGO_MAX_BYTES)
  byteSize!: number;
}
