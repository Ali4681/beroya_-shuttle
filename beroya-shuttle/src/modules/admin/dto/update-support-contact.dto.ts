import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { PHONE_PATTERN } from '../../../common/utils/phone';

export class UpdateSupportContactDto {
  @ApiPropertyOptional({ example: '+963944000111', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  supportPhone?: string | null;
}
