import { Global, Module } from '@nestjs/common';
import { UploadsService } from '../../modules/institution/uploads.service';
import { LocalStorageController } from './local-storage.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [StorageService, UploadsService],
  exports: [StorageService, UploadsService],
})
export class StorageModule {}
