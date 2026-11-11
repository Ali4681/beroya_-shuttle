import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  APP_BRANDING_PURPOSES,
  APP_ICON_IDS,
  SPLASH_ANIMATION_TYPES,
} from '../../../infra/storage/app-branding-storage';

const HEX = /^#(?:[0-9a-fA-F]{6})$/;

export class AppBrandingSplashInputDto {
  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  animationUrl?: string | null;

  @IsOptional()
  @IsIn(SPLASH_ANIMATION_TYPES)
  animationType?: (typeof SPLASH_ANIMATION_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(15000)
  duration?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AppBrandingAnimationsInputDto {
  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  loading?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  home?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  success?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  error?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  empty?: string | null;
}

export class AppBrandingIconInputDto {
  @IsOptional()
  @IsIn(APP_ICON_IDS)
  android?: (typeof APP_ICON_IDS)[number];

  @IsOptional()
  @IsIn(APP_ICON_IDS)
  ios?: (typeof APP_ICON_IDS)[number];
}

export class UpdateAppBrandingDto {
  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @Matches(HEX, { message: 'primary_color must be a hex color' })
  primaryColor?: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @Matches(HEX, { message: 'secondary_color must be a hex color' })
  secondaryColor?: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @Matches(HEX, { message: 'background_color must be a hex color' })
  backgroundColor?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppBrandingSplashInputDto)
  splash?: AppBrandingSplashInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppBrandingAnimationsInputDto)
  animations?: AppBrandingAnimationsInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppBrandingIconInputDto)
  appIcon?: AppBrandingIconInputDto;
}

export class PresignAppBrandingUploadDto {
  @IsIn(APP_BRANDING_PURPOSES)
  purpose!: (typeof APP_BRANDING_PURPOSES)[number];

  @IsString()
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  byteSize!: number;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class CompleteAppBrandingUploadDto {
  @IsIn(APP_BRANDING_PURPOSES)
  purpose!: (typeof APP_BRANDING_PURPOSES)[number];

  @IsString()
  @Matches(
    /^platform\/app-branding\/(passenger|crew)\/[a-z_]+\/[a-zA-Z0-9._-]+$/,
  )
  objectKey!: string;
}
