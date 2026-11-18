import { Module } from '@nestjs/common';
import { R2QuarantineStorageService } from './r2-quarantine-storage.service';

@Module({
  providers: [R2QuarantineStorageService],
  exports: [R2QuarantineStorageService],
})
export class StorageModule {}
