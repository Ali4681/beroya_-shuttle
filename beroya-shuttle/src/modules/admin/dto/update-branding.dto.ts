import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{6})$/;

export class UpdateBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  useInstitutionIdentity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#1F4E79' })
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @Matches(HEX_COLOR, { message: 'primary_color must be a hex color' })
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#F4A261' })
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @Matches(HEX_COLOR, { message: 'secondary_color must be a hex color' })
  secondaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(140)
  @Matches(/^[^<>]*$/, { message: 'welcome_message cannot contain HTML' })
  welcomeMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supportPhone?: string;
}
