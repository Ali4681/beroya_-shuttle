import { IsIn, IsOptional, IsString } from 'class-validator';
import { APP_BRANDING_APPS } from '../../../infra/storage/app-branding-storage';

export class AppBrandingQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(APP_BRANDING_APPS)
  app?: (typeof APP_BRANDING_APPS)[number];
}
